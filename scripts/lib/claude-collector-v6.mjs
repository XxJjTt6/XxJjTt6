import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { mergeCodeRecords, aggregateCode, bucket, TOKEN_FIELDS, SURFACES, dateInZone, writeJsonAtomic } from "./claude-usage-v1.mjs";

export async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

export function sanitizeRecord(record) {
  if (!record || !/^[a-f0-9]{64}$/.test(record.id) || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return null;
  if (!TOKEN_FIELDS.every((key) => Number.isSafeInteger(record[key]) && record[key] >= 0)) return null;
  if (!Number.isSafeInteger(TOKEN_FIELDS.reduce((sum, key) => sum + record[key], 0))) return null;
  const surfaces = [...new Set((record.surfaces ?? []).filter((s) => SURFACES.includes(s)))];
  // Reject unexpected model text rather than letting log contents become public labels.
  const model = /^[a-zA-Z0-9._:/-]{1,128}$/.test(record.model) ? record.model : "unknown";
  return { id: record.id, date: record.date, model, surfaces: surfaces.length ? surfaces : ["unknown"],
    ...Object.fromEntries(TOKEN_FIELDS.map((key) => [key, record[key]])) };
}

export function mergeLedger(previous, incoming, timeZone) {
  if (previous && previous.timeZone !== timeZone) throw new Error("Ledger timezone changed; migrate the ledger before scanning.");
  const records = [...(previous?.records ?? []), ...incoming].map(sanitizeRecord);
  if (records.some((record) => !record)) throw new Error("Invalid numeric ledger record; refusing to overwrite history.");
  return { schemaVersion: "claude-numeric-ledger-v6", timeZone,
    records: mergeCodeRecords(records).sort((a, b) => a.id.localeCompare(b.id)) };
}

export function summarizeLedger(ledger, now = new Date()) {
  const claude = ledger.records.filter((r) => /^claude(?:-|\.)/i.test(r.model));
  const other = ledger.records.filter((r) => !/^claude(?:-|\.)/i.test(r.model));
  const aggregate = aggregateCode(claude);
  const coverage = Object.fromEntries(SURFACES.map((surface) => {
    const attributed = claude.filter((r) => r.surfaces.includes(surface));
    const lastRecordDate = attributed.map((r) => r.date).sort().at(-1) ?? null;
    const stale = lastRecordDate && new Date(`${dateInZone(now.toISOString(), ledger.timeZone)}T00:00:00Z`).getTime() - new Date(`${lastRecordDate}T00:00:00Z`).getTime() > 7 * 86400000;
    return [surface, { status: !lastRecordDate ? "not-observed" : stale ? "stale" : "observed-partial", lastRecordDate }];
  }));
  return { ...aggregate, measurement: "provider-reported-observed-usage",
    scope: "Deduplicated retained Claude-model usage only. Partial; not a full account bill. Do not add to Tokscale totals.",
    coverage, otherModels: bucket(other), complete: false };
}

export function defaultDesktopDirectory() {
  const base = process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support", "Claude")
    : process.platform === "win32" ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude")
      : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Claude");
  return path.join(base, "IndexedDB");
}

export function scanDesktop(root, config) {
  if (!config.desktopEnabled) return { status: "disabled", records: [], diagnostics: {} };
  const python = config.desktopPython || path.join(root, ".private", "desktop-python", "bin", "python");
  const result = spawnSync(python, [path.join(root, "scripts", "scan-desktop-indexeddb.py"),
    "--directory", config.desktopIndexedDB || defaultDesktopDirectory(), "--time-zone", config.timeZone],
  { encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) return { status: "error", records: [], diagnostics: { errorCode: result.error.code || "SPAWN_FAILED" } };
  try {
    const value = JSON.parse(result.stdout);
    if (!Array.isArray(value.records)) throw new Error("bad adapter output");
    return value;
  } catch { return { status: "error", records: [], diagnostics: { errorCode: "INVALID_ADAPTER_OUTPUT" } }; }
}

export async function acquireLock(root, name = "collector") {
  const directory = path.join(root, ".private");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, `${name}.lock`);
  try { await fs.mkdir(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    // Owner PID allows crash recovery without stealing a lock from a slow live scan.
    const owner = await readJson(path.join(lock, "owner.json"));
    if (!owner) throw new Error("Collector lock has no owner; inspect .private/collector.lock.");
    try { process.kill(owner.pid, 0); throw new Error("Collector is already running."); }
    catch (e) { if (e.code !== "ESRCH") throw e; }
    await fs.rm(lock, { recursive: true });
    await fs.mkdir(lock, { mode: 0o700 });
  }
  await writeJsonAtomic(path.join(lock, "owner.json"), { pid: process.pid }, { privateFile: true });
  return () => fs.rm(lock, { recursive: true, force: true });
}

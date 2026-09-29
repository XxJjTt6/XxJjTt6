import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { createHash } from "node:crypto";

export const SURFACES = ["desktop-code", "desktop-cowork", "desktop-chat", "desktop-unclassified", "desktop-thirdparty", "vscode", "cli", "shared", "unknown"];
export const TOKEN_FIELDS = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"];
const SOURCE_FIELDS = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];

export function hashId(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  // A context-window size, quota percentage, or total-only counter is not request usage.
  if (!["input_tokens", "output_tokens"].every((key) => Object.hasOwn(usage, key))) return null;
  const values = SOURCE_FIELDS.map((key) => Object.hasOwn(usage, key) ? usage[key] : 0);
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) return null;
  if (!Number.isSafeInteger(values.reduce((a, b) => a + b, 0))) return null;
  return Object.fromEntries(TOKEN_FIELDS.map((key, index) => [key, values[index]]));
}

export function dateInZone(value, timeZone) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function classifySurface(entrypoint, hint = "unknown") {
  const source = String(entrypoint ?? "").toLowerCase();
  if (/vscode|vs-code|vs_code/.test(source)) return "vscode";
  if (source === "claude-desktop-3p") return "desktop-thirdparty";
  if (/cowork/.test(source)) return "desktop-cowork";
  if (/desktop/.test(source)) return "desktop-code";
  if (["cli", "claude-cli"].includes(source)) return "cli";
  return SURFACES.includes(hint) ? hint : "unknown";
}

export function codeRecord(event, { surface = "unknown", timeZone = "Asia/Shanghai" } = {}) {
  if (event?.type !== "assistant" || !event.message || event.message.model === "<synthetic>") return null;
  const usage = normalizeUsage(event.message.usage);
  const date = dateInZone(event.timestamp, timeZone);
  const messageId = event.message.id;
  const eventId = event.uuid;
  if (!usage || !date || (!messageId && !eventId)) return null;
  // Provider message IDs remain stable when copied between Desktop, CLI and VS Code.
  // request_id spelling/absence must not create another charge for the same message.
  const id = hashId(messageId
    ? `message:${messageId}`
    : `event:${event.sessionId ?? ""}:${eventId}`);
  return {
    id, date, model: String(event.message.model || "unknown"), ...usage,
    surfaces: [classifySurface(event.entrypoint, surface)]
  };
}

export function mergeCodeRecords(records) {
  const merged = new Map();
  for (const record of records) {
    const previous = merged.get(record.id);
    if (!previous) {
      merged.set(record.id, { ...record, surfaces: [...record.surfaces] });
      continue;
    }
    // Streaming chunks may carry only the updated output counter. Never sum snapshots.
    for (const key of TOKEN_FIELDS) previous[key] = Math.max(previous[key], record[key]);
    if (previous.model === "unknown" && record.model !== "unknown") previous.model = record.model;
    previous.date = [previous.date, record.date].sort()[0];
    previous.surfaces = [...new Set([...previous.surfaces, ...record.surfaces])];
  }
  return [...merged.values()];
}

export function bucket(records) {
  const totals = { messages: records.length, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 };
  for (const record of records) for (const key of TOKEN_FIELDS) totals[key] += record[key] ?? 0;
  totals.totalTokens = TOKEN_FIELDS.reduce((sum, key) => sum + totals[key], 0);
  return totals;
}

export function aggregateCode(records) {
  const unique = mergeCodeRecords(records);
  const groups = Object.fromEntries(SURFACES.map((surface) => [surface, []]));
  for (const record of unique) {
    const known = record.surfaces.filter((surface) => surface !== "unknown");
    const surface = known.length > 1 ? "shared" : known[0] ?? "unknown";
    groups[surface].push(record);
  }
  const days = [...new Set(unique.map((record) => record.date))].sort();
  return {
    measurement: "provider-reported-local-transcripts",
    scope: "Local Claude Code client usage, including non-Anthropic models if configured. A subset of Tokscale, never added again.",
    totals: bucket(unique),
    surfaces: Object.fromEntries(SURFACES.map((surface) => [surface, {
      status: groups[surface].length ? "observed" : "no-attributed-records",
      ...bucket(groups[surface])
    }])),
    daily: days.map((date) => ({ date, ...bucket(unique.filter((record) => record.date === date)) }))
  };
}

export function defaultCodeRoots({ home = os.homedir(), env = process.env, platform = process.platform } = {}) {
  const configs = new Set([path.join(home, ".claude"), path.join(home, ".config", "claude")]);
  if (env.CLAUDE_CONFIG_DIR) configs.add(path.resolve(env.CLAUDE_CONFIG_DIR));
  const roots = [...configs].flatMap((root) => ["projects", "transcripts"].map((name) => ({
    path: path.join(root, name), surface: "unknown"
  })));
  const desktop = platform === "darwin"
    ? path.join(home, "Library", "Application Support", "Claude")
    : platform === "win32" ? path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude")
      : path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "Claude");
  roots.push({ path: path.join(desktop, "claude-code-sessions"), surface: "desktop-code" });
  // Cowork is deliberately not relabeled as Desktop Code.
  return roots;
}

export async function readLocalConfig(root, env = process.env) {
  const file = env.CLAUDE_USAGE_CONFIG || path.join(root, ".private", "claude-usage.local.json");
  let config = {};
  try { config = JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const timeZone = config.timeZone || "Asia/Shanghai";
  dateInZone(new Date().toISOString(), timeZone);
  if (config.chatTextEstimates !== undefined && typeof config.chatTextEstimates !== "boolean") {
    throw new TypeError("chatTextEstimates must be a boolean.");
  }
  if (config.includeDefaultRoots !== undefined && typeof config.includeDefaultRoots !== "boolean") {
    throw new TypeError("includeDefaultRoots must be a boolean.");
  }
  if (config.extraCodeRoots !== undefined && !Array.isArray(config.extraCodeRoots)) throw new TypeError("extraCodeRoots must be an array.");
  const extras = (config.extraCodeRoots ?? []).map((entry) => {
    if (!entry || typeof entry.path !== "string" || !path.isAbsolute(entry.path) || !SURFACES.includes(entry.surface ?? "unknown")) {
      throw new TypeError("Each extraCodeRoots entry needs an absolute path and a supported surface.");
    }
    return { path: entry.path, surface: entry.surface ?? "unknown" };
  });
  return { timeZone, chatTextEstimates: config.chatTextEstimates ?? true,
    desktopIndexedDB: config.desktopIndexedDB, desktopPython: config.desktopPython,
    desktopEnabled: config.desktopEnabled !== false && config.includeDefaultRoots !== false,
    roots: [...(config.includeDefaultRoots === false ? [] : defaultCodeRoots({ env })), ...extras] };
}

export async function scanCodeRoots(roots, { timeZone = "Asia/Shanghai" } = {}) {
  const records = [];
  const seenFiles = new Set();
  const diagnostics = { missingRoots: 0, unreadableEntries: 0, invalidLines: 0, ignoredUsageRecords: 0, filesScanned: 0 };
  const existingRoots = [];
  async function visit(target, surface) {
    let stat;
    try { stat = await fs.lstat(target); }
    catch { diagnostics.unreadableEntries += 1; return; }
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      let entries;
      try { entries = await fs.readdir(target, { withFileTypes: true }); }
      catch { diagnostics.unreadableEntries += 1; return; }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (["node_modules", ".git", "skills-plugin"].includes(entry.name)) continue;
        await visit(path.join(target, entry.name), surface);
      }
      return;
    }
    if (!stat.isFile() || !target.endsWith(".jsonl")) return;
    const canonical = await fs.realpath(target);
    if (seenFiles.has(canonical)) return;
    seenFiles.add(canonical);
    try {
      const sessionSurfaces = new Map();
      const fileRecords = [];
      const lines = readline.createInterface({ input: createReadStream(target), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { diagnostics.invalidLines += 1; continue; }
        const session = event.sessionId ?? event.session_id;
        if (session && event.entrypoint) sessionSurfaces.set(session, classifySurface(event.entrypoint, surface));
        const record = codeRecord(event, { surface, timeZone });
        if (record) fileRecords.push({ record, session });
        else if (event?.type === "assistant" && event?.message?.usage) diagnostics.ignoredUsageRecords += 1;
      }
      for (const { record, session } of fileRecords) {
        if (record.surfaces[0] === "unknown" && sessionSurfaces.has(session)) record.surfaces = [sessionSurfaces.get(session)];
        records.push(record);
      }
      diagnostics.filesScanned += 1;
    } catch { diagnostics.unreadableEntries += 1; }
  }
  // Explicit attribution wins when the same path is supplied by an extra root.
  for (const root of [...roots].sort((a, b) => Number(b.surface !== "unknown") - Number(a.surface !== "unknown"))) {
    try {
      const canonical = await fs.realpath(root.path);
      if (!existingRoots.includes(canonical)) existingRoots.push(canonical);
      await visit(canonical, root.surface);
    } catch (error) {
      if (error.code === "ENOENT") diagnostics.missingRoots += 1;
      else diagnostics.unreadableEntries += 1;
    }
  }
  return { ...aggregateCode(records), records: mergeCodeRecords(records), diagnostics, existingRoots };
}

export function tokscaleScanEnv(roots, env = process.env) {
  const dirs = [...new Set(roots.map((root) => typeof root === "string" ? root : root.path))];
  if (dirs.some((dir) => /[,\n\r]/.test(dir))) throw new Error("Tokscale extra scan paths cannot contain commas or newlines.");
  const extra = dirs.map((dir) => `claude:${dir}`).join(",");
  return { ...env, TOKSCALE_EXTRA_DIRS: [env.TOKSCALE_EXTRA_DIRS, extra].filter(Boolean).join(",") };
}

export async function writeJsonAtomic(file, data, { privateFile = false } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true, ...(privateFile ? { mode: 0o700 } : {}) });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: privateFile ? 0o600 : 0o644 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

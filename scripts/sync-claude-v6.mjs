#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { scanClaudeUsage } from "./scan-claude-usage-v1.mjs";
import { readJson, acquireLock } from "./lib/claude-collector-v6.mjs";
import { readLocalConfig, tokscaleScanEnv, writeJsonAtomic } from "./lib/claude-usage-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => !["--publish", "--force-publish"].includes(arg))) throw new Error("Usage: sync-claude-v6.mjs [--publish] [--force-publish]");
const config = await readLocalConfig(root);
const env = { ...tokscaleScanEnv(config.roots, process.env), GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=15" };
for (const key of ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_ENTERPRISE_TOKEN", "GH_ENTERPRISE_TOKEN"]) delete env[key];
function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`GIT_${args[0].toUpperCase()}_FAILED`);
  return result.stdout.trim();
}
const release = await acquireLock(root, "sync");
try {
  const statusFile = path.join(root, ".private", "sync-status-v6.json");
  const previous = await readJson(statusFile, {});
  const { snapshot } = await scanClaudeUsage(root);
  // Local collection commits to the numeric ledger before any network work starts.
  const generated = spawnSync(process.execPath, [path.join(root, "scripts", "generate-tokscale-profile.mjs")], { cwd: root, env, encoding: "utf8" });
  if (generated.status !== 0) throw new Error("LOCAL_REPORT_FAILED");
  const deepseek = spawnSync(process.execPath, [path.join(root, "scripts", "scan-deepseek-desktop-usage-v1.mjs"), "--sessions", process.env.DEEPSEEK_DESKTOP_SESSIONS || path.join(os.homedir(), ".dsh", "sessions"), "--out", path.join(root, "data", "deepseek-desktop-usage.json")], { cwd: root, env, encoding: "utf8", timeout: 60000 });
  const status = { ...previous, deepseek: deepseek.status === 0 ? "ok" : "error", lastScanAt: snapshot.generatedAt, collection: snapshot.health.status };
  await writeJsonAtomic(statusFile, status, { privateFile: true });
  const day = snapshot.generatedAt.slice(0, 10);
  const backup = path.join(root, ".private", "ledger-backups", `${day}.json`);
  await fs.mkdir(path.dirname(backup), { recursive: true, mode: 0o700 });
  try { await fs.copyFile(path.join(root, ".private", "claude-numeric-ledger-v6.json"), backup, 1); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const backups = (await fs.readdir(path.dirname(backup))).filter((s) => /^\d{4}-\d{2}-\d{2}\.json$/.test(s)).sort();
  for (const old of backups.slice(0, -14)) await fs.rm(path.join(path.dirname(backup), old));
  const due = !status.lastPublishAt || Date.now() - new Date(status.lastPublishAt).getTime() > 3600000;
  if ((args.includes("--publish") && due) || args.includes("--force-publish")) {
    try {
      // Preserve the pre-existing Codex/Claude Tokscale submission workflow. Its
      // failure is independent of the Desktop numeric ledger and GitHub publication.
      if (process.env.CLAUDE_USAGE_SKIP_TOKSCALE !== "1") {
        const command = process.env.TOKSCALE_BINARY || "npx";
        const prefix = process.env.TOKSCALE_BINARY ? [] : ["-y", "tokscale@latest"];
        let submit;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          submit = spawnSync(command, [...prefix, "submit", "--client", "codex,claude"], { cwd: root, env, encoding: "utf8", timeout: 180000 });
          if (submit.status === 0) break;
        }
        status.tokscaleSubmit = submit.status === 0 ? "ok" : "error";
        if (submit.status === 0) {
          status.lastTokscaleSubmitAt = new Date().toISOString();
          delete status.tokscaleError;
        } else {
          status.tokscaleError = submit.error?.code === "ETIMEDOUT" ? "TIMED_OUT"
            : /not logged|unauthorized|log in|401/i.test((submit.stdout ?? "") + (submit.stderr ?? "")) ? "AUTH_REQUIRED" : "SUBMIT_FAILED";
        }
      }
      const outbox = path.join(root, ".private", "github-outbox");
      const url = git(root, ["remote", "get-url", "origin"]);
      try { await fs.access(path.join(outbox, ".git")); }
      catch { git(root, ["clone", "--single-branch", "--branch", "main", "--", url, outbox]); }
      const expected = ["README.md", "README.tokscale-v3.md", "data/claude-usage.json"];
      const dirty = git(outbox, ["status", "--porcelain", "--untracked-files=all"]);
      if (dirty) throw new Error("OUTBOX_DIRTY_REQUIRES_REVIEW");
      if (git(outbox, ["remote", "get-url", "origin"]) !== url) throw new Error("OUTBOX_REMOTE_MISMATCH");
      if (git(outbox, ["branch", "--show-current"]) !== "main") throw new Error("OUTBOX_BRANCH_MISMATCH");
      git(outbox, ["fetch", "origin", "main"]);
      git(outbox, ["rebase", "origin/main"]);
      await writeJsonAtomic(path.join(outbox, "data", "claude-usage.json"), snapshot);
      // A deployed outbox regenerates the original Codex/DeepSeek presentation using
      // the newest remote Tokscale graph, so replacing v4 does not drop its sources.
      let deployed = false;
      try { await fs.access(path.join(outbox, "scripts", "lib", "claude-collector-v6.mjs")); deployed = true; } catch {}
      if (deployed) {
        if (process.env.CLAUDE_USAGE_SKIP_TOKSCALE !== "1") {
          const refresh = spawnSync(process.execPath, [path.join(outbox, "scripts", "fetch-tokscale-public.mjs"), "--username", "XxJjTt6", "--out", path.join(outbox, "data", "tokscale-graph.json")], { cwd: outbox, env, encoding: "utf8", timeout: 60000 });
          status.tokscaleRefresh = refresh.status === 0 ? "ok" : "error";
          if (refresh.status === 0) expected.push("data/tokscale-graph.json");
        }
        if (deepseek.status === 0) {
          await fs.copyFile(path.join(root, "data", "deepseek-desktop-usage.json"), path.join(outbox, "data", "deepseek-desktop-usage.json"));
          expected.push("data/deepseek-desktop-usage.json");
        }
        const regenerated = spawnSync(process.execPath, [path.join(outbox, "scripts", "generate-tokscale-profile.mjs")], { cwd: outbox, env, encoding: "utf8" });
        if (regenerated.status !== 0) throw new Error("OUTBOX_GENERATE_FAILED");
        expected.push("data/tokscale-summary.json", "assets/tokscale-ai-usage-card.svg", "assets/tokscale-ai-token-heatmap.svg");
      }
      git(outbox, ["add", "--", ...expected]);
      if (git(outbox, ["diff", "--cached", "--name-only"])) git(outbox, ["commit", "-m", "chore: sync observed Claude usage and coverage"]);
      // Do not resolve conflicts or force push; failed publication is retried next scan.
      git(outbox, ["pull", "--rebase", "origin", "main"]);
      git(outbox, ["push", "origin", "HEAD:main"]);
      status.lastPublishAt = new Date().toISOString();
      status.publication = "ok";
      status.consecutivePublishFailures = 0;
      delete status.publishError;
      console.log("Claude aggregate snapshot published to GitHub.");
    } catch (error) {
      status.publication = "error";
      status.publishError = /^[A-Z_]+$/.test(error.message) ? error.message : "PUBLICATION_FAILED";
      status.consecutivePublishFailures = (status.consecutivePublishFailures ?? 0) + 1;
      console.error(`Publication failed (${status.publishError}); collected history is retained for retry.`);
      process.exitCode = 2;
    }
    await writeJsonAtomic(statusFile, status, { privateFile: true });
  }
} finally { await release(); }

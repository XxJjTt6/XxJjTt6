#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommandEnv } from "./lib/tokscale-profile-refresh-v1.mjs";
import { readLocalConfig, tokscaleScanEnv } from "./lib/claude-usage-v1.mjs";
import { buildSyncTokenV5Plan, SYNC_TOKEN_V5_GENERATED_PATHS, unrelatedDirtyPaths } from "./lib/sync-token-now-v5.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => !["--dry-run", "--publish"].includes(arg)) || (args.includes("--dry-run") && args.includes("--publish"))) {
  throw new Error("Usage: npm run sync:tokens -- --dry-run | --publish");
}
const publish = args.includes("--publish");
const branch = process.env.TOKSCALE_PROFILE_BRANCH || "main";
const config = await readLocalConfig(root);
const env = tokscaleScanEnv(config.roots, buildCommandEnv(process.env));
for (const name of ["GH_TOKEN", "GITHUB_ENTERPRISE_TOKEN", "GH_ENTERPRISE_TOKEN"]) delete env[name];
const plan = buildSyncTokenV5Plan({
  clients: process.env.TOKSCALE_PROFILE_CLIENTS || "codex,claude",
  remote: process.env.TOKSCALE_PROFILE_REMOTE || "origin", branch,
  sessionsRoot: process.env.DEEPSEEK_DESKTOP_SESSIONS,
  message: "chore: sync token usage with Claude multi-surface coverage"
});

function run(step) {
  console.log(`[sync-token-v5] ${step.label}`);
  if (!publish) {
    console.log(JSON.stringify({ command: step.command, args: step.args }));
    return;
  }
  if (step.skipIfNoChanges) {
    const diff = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: root, env });
    if (diff.status === 0) return;
    if (diff.status !== 1) throw new Error("Cannot inspect staged changes.");
  }
  const attempts = step.retry?.attempts ?? 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(step.command, step.args, { cwd: root, env, stdio: "inherit", timeout: step.timeoutMs });
    if (!result.error && result.status === 0) return;
    if (attempt < attempts) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, step.retry.delayMs);
  }
  if (step.fallback?.length) {
    for (const fallback of step.fallback) run(fallback);
    return;
  }
  throw new Error(`${step.label} failed; publication stopped.`);
}

if (publish) {
  const git = (gitArgs) => {
    const result = spawnSync("git", gitArgs, { cwd: root, env, encoding: "utf8" });
    if (result.status !== 0) throw new Error("Git preflight failed.");
    return result.stdout;
  };
  if (git(["branch", "--show-current"]).trim() !== branch) throw new Error(`Publication requires the configured deployment branch (${branch}).`);
  if (git(["diff", "--cached", "--name-only"]).trim()) throw new Error("Resolve pre-existing staged changes before publishing.");
  const status = git(["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (unrelatedDirtyPaths(status).length) throw new Error("Unrelated working-tree changes must be committed or resolved before publishing.");
  console.log("Publishing aggregate usage to Tokscale and GitHub.");
  if (status) {
    // Import/scan prepares generated artifacts. Preserve those explicitly before rebasing.
    run({ label: "Stage previously prepared aggregate artifacts", command: "git", args: ["add", "--", ...SYNC_TOKEN_V5_GENERATED_PATHS] });
    run({ label: "Commit previously prepared aggregate artifacts", command: "git", args: ["commit", "-m", "chore: preserve locally prepared token aggregates"], skipIfNoChanges: true });
  }
} else {
  console.log("Dry run only: no scans, writes, network calls or Git changes. Add --publish to run the deployed workflow.");
}
for (const step of plan) run(step);
console.log(publish ? "[sync-token-v5] Aggregate usage pushed to GitHub." : "[sync-token-v5] Dry run complete.");

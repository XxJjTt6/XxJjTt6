import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("local-first publisher survives a network failure and publishes only aggregates", async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "claude-publish-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, "collector"), remote = path.join(temp, "remote.git");
  await fs.mkdir(root);
  const git = (cwd, args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git(temp, ["init", "--bare", remote]);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "Usage Test"]);
  await fs.writeFile(path.join(root, "README.md"), "# Existing profile\nExisting introduction.\n");
  await fs.writeFile(path.join(root, "README.tokscale-v3.md"), "# Existing profile\n");
  git(root, ["add", "."]); git(root, ["commit", "-m", "initial"]);
  git(root, ["remote", "add", "origin", remote]); git(root, ["push", "-u", "origin", "main"]);
  await fs.cp(path.resolve("scripts"), path.join(root, "scripts"), { recursive: true });
  await fs.mkdir(path.join(root, "data")); await fs.mkdir(path.join(root, ".private"));
  await fs.writeFile(path.join(root, ".private", "claude-usage.local.json"), JSON.stringify({ includeDefaultRoots: false }));
  await fs.writeFile(path.join(root, "data", "tokscale-graph.json"), JSON.stringify({ meta: { dateRange: { start: "2026-09-29", end: "2026-09-29" } }, summary: { totalTokens: 100, totalCost: 0 }, contributions: [] }));
  const run = () => spawnSync(process.execPath, [path.join(root, "scripts/sync-claude-v6.mjs"), "--force-publish"], { cwd: root,
    env: { ...process.env, CLAUDE_USAGE_SKIP_TOKSCALE: "1", DEEPSEEK_DESKTOP_SESSIONS: path.join(temp, "empty-sessions"), CLAUDE_USAGE_CONFIG: path.join(root, ".private", "claude-usage.local.json"), GIT_AUTHOR_NAME: "Usage Test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "Usage Test", GIT_COMMITTER_EMAIL: "test@example.invalid" }, encoding: "utf8" });
  let result = run(); assert.equal(result.status, 0, result.stderr);
  const files = git(temp, ["--git-dir", remote, "ls-tree", "-r", "--name-only", "main"]);
  assert.doesNotMatch(files, /private|ledger|scripts|collector\.log/);
  const readme = git(temp, ["--git-dir", remote, "show", "main:README.md"]);
  assert.match(readme, /Existing introduction/);
  assert.match(readme, /Claude 多入口用量/);
  git(root, ["remote", "set-url", "origin", path.join(temp, "unavailable.git")]);
  result = run(); assert.equal(result.status, 2);
  const status = JSON.parse(await fs.readFile(path.join(root, ".private", "sync-status-v6.json"), "utf8"));
  assert.equal(status.publication, "error");
  assert.ok(status.lastScanAt);
  assert.ok(JSON.parse(await fs.readFile(path.join(root, ".private", "claude-numeric-ledger-v6.json"), "utf8")));
});

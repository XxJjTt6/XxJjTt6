import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Chat import CLI, ZIP, report generation and safe dry run work without a live account", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claude-integration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(path.join(project, "scripts"), path.join(root, "scripts"), { recursive: true });
  await fs.mkdir(path.join(root, "data"));
  await fs.mkdir(path.join(root, ".private"));
  await fs.writeFile(path.join(root, ".private", "claude-usage.local.json"), JSON.stringify({ includeDefaultRoots: false }));
  await fs.writeFile(path.join(root, "data", "tokscale-graph.json"), JSON.stringify({
    meta: { dateRange: { start: "2026-09-29", end: "2026-09-29" } },
    summary: { totalTokens: 100, totalCost: 0 }, contributions: []
  }));
  const payload = [{ uuid: "PRIVATE-CONVERSATION", name: "PRIVATE-TITLE", chat_messages: [
    { uuid: "PRIVATE-MESSAGE", sender: "assistant", created_at: "2026-09-29T00:00:00Z", text: "PRIVATE-CONTENT", usage: { input_tokens: 100, output_tokens: 20 } }
  ] }];
  const input = path.join(root, "export.json");
  await fs.writeFile(input, JSON.stringify(payload));
  const env = { ...process.env, CLAUDE_USAGE_CONFIG: path.join(root, ".private", "claude-usage.local.json") };
  const run = (script, args = []) => spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { cwd: root, env, encoding: "utf8" });
  let result = run("import-claude-chat-v1.mjs", [input]);
  assert.equal(result.status, 0, result.stderr);
  result = run("import-claude-chat-v1.mjs", [input]);
  assert.equal(result.status, 0, result.stderr);
  const read = async (file) => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
  const snapshot = await read("data/claude-usage.json");
  assert.equal(snapshot.chat.messages, 1);
  assert.equal(snapshot.chat.reportedTokens.totalTokens, 120);
  assert.equal(snapshot.code.totals.messages, 0);
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE-|export\.json/);
  assert.doesNotMatch(await fs.readFile(path.join(root, ".private", "claude-chat-ledger.json"), "utf8"), /PRIVATE-/);
  assert.doesNotMatch(await fs.readFile(path.join(root, "README.md"), "utf8"), /Claude 多入口用量|\| Window \|/);
  assert.equal((await read("data/tokscale-summary.json")).totals.totalTokens, 100);
  const before = await fs.readFile(path.join(root, "data", "claude-usage.json"), "utf8");
  result = run("sync-token-now-v5.mjs", ["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run complete/);
  assert.equal(await fs.readFile(path.join(root, "data", "claude-usage.json"), "utf8"), before);

  const zip = path.join(root, "export.zip");
  const zipped = spawnSync("python3", ["-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[2],'w'); z.writestr('../../conversations.json',open(sys.argv[1]).read()); z.close()", input, zip], { encoding: "utf8" });
  assert.equal(zipped.status, 0, zipped.stderr);
  result = run("import-claude-chat-v1.mjs", [zip, "--no-estimates"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await read("data/claude-usage.json")).chat.messages, 1);
  assert.equal((await read("data/claude-usage.json")).chat.textEstimate, null);
  assert.equal((await read("data/claude-usage.json")).chat.reportedTokens.totalTokens, 120);

  const ledgerBefore = await fs.readFile(path.join(root, ".private", "claude-chat-ledger.json"), "utf8");
  await fs.writeFile(input, JSON.stringify({ samples: [{ u: { fh: 70 } }] }));
  result = run("import-claude-chat-v1.mjs", [input]);
  assert.notEqual(result.status, 0);
  assert.equal(await fs.readFile(path.join(root, ".private", "claude-chat-ledger.json"), "utf8"), ledgerBefore);
});

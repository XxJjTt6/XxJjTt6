import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { hashId, codeRecord } from "../scripts/lib/claude-usage-v1.mjs";
import { mergeLedger, summarizeLedger, sanitizeRecord, acquireLock } from "../scripts/lib/claude-collector-v6.mjs";
import { importChatInbox } from "../scripts/lib/claude-inbox-v6.mjs";
const fixture = { id: hashId("message:response-1"), date: "2026-09-29", model: "claude-opus-4-6", surfaces: ["desktop-cowork"], inputTokens: 5, outputTokens: 8, cacheReadTokens: 100, cacheWriteTokens: 20 };

test("retains counters after cache eviction and merges larger streaming snapshots once across sources", () => {
  let ledger = mergeLedger(null, [fixture], "Asia/Shanghai");
  ledger = mergeLedger(ledger, [], "Asia/Shanghai");
  assert.equal(summarizeLedger(ledger).totals.totalTokens, 133);
  ledger = mergeLedger(ledger, [{ ...fixture, outputTokens: 18, surfaces: ["vscode"] }, fixture], "Asia/Shanghai");
  const report = summarizeLedger(ledger);
  assert.equal(report.totals.totalTokens, 143);
  assert.equal(report.totals.messages, 1);
  assert.equal(report.surfaces.shared.messages, 1);
  assert.equal(report.coverage.vscode.status, "observed-partial");
  assert.equal(report.coverage.cli.status, "not-observed");
  assert.equal(report.complete, false);
});

test("separates third party providers and rejects invalid ledgers instead of erasing them", () => {
  const ledger = mergeLedger(null, [fixture, { ...fixture, id: hashId("third-party"), model: "deepseek-chat" }], "Asia/Shanghai");
  assert.equal(summarizeLedger(ledger).totals.totalTokens, 133);
  assert.equal(summarizeLedger(ledger).otherModels.totalTokens, 133);
  assert.equal(sanitizeRecord({ ...fixture, outputTokens: -1 }), null);
  assert.throws(() => mergeLedger(ledger, [], "UTC"), /timezone/);
  const clean = sanitizeRecord({ ...fixture, content: "PRIVATE-TEXT", title: "PRIVATE-TITLE" });
  assert.doesNotMatch(JSON.stringify(clean), /PRIVATE/);
});

test("Desktop snake_case request_id and CLI requestId use the same response identity", () => {
  const script = path.resolve("scripts/scan-desktop-indexeddb.py");
  const py = spawnSync("python3", ["-c", `import sys,importlib.util,json
spec=importlib.util.spec_from_file_location('adapter',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
e={'serverCreatedAt':1790697600000,'payload':{'type':'assistant','request_id':'remote-request','message':{'id':'response-1','model':'claude-opus-4-6','content':'PRIVATE-TEXT','usage':{'input_tokens':5,'output_tokens':8,'cache_read_input_tokens':100,'cache_creation_input_tokens':20,'cache_creation':{'ephemeral_5m_input_tokens':20}}}}}
r=m.record_from_event(e,'cowork','Asia/Shanghai')
assert m.record_from_event({'payload':{'type':'result','usage':e['payload']['message']['usage']}},'cowork','Asia/Shanghai') is None
assert m.record_from_event({'payload':{'type':'assistant','message':'bad'}},'cowork','Asia/Shanghai') is None
print(json.dumps(r))`, script], { encoding: "utf8" });
  assert.equal(py.status, 0, py.stderr);
  const desktop = JSON.parse(py.stdout);
  const cli = codeRecord({ type: "assistant", timestamp: "2026-09-29T10:00:00Z", entrypoint: "cli", requestId: "transport-request", message: { id: "response-1", model: fixture.model, usage: { input_tokens: 5, output_tokens: 8, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 } } });
  assert.equal(desktop.id, cli.id);
  assert.doesNotMatch(py.stdout, /PRIVATE|remote-request|response-1/);
  assert.equal(summarizeLedger(mergeLedger(null, [desktop, cli], "Asia/Shanghai")).totals.totalTokens, 133);
});

test("collector lock prevents simultaneous writers and releases cleanly", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claude-lock-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const release = await acquireLock(root);
  await assert.rejects(acquireLock(root), /already running/);
  await release();
  await (await acquireLock(root))();
});

test("automatic Chat inbox imports only new content and preserves history on malformed export", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claude-inbox-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const inbox = path.join(root, ".private", "chat-imports");
  await fs.mkdir(inbox, { recursive: true });
  const file = path.join(inbox, "conversations.json");
  await fs.writeFile(file, JSON.stringify([{ uuid: "PRIVATE-CONV", chat_messages: [{ uuid: "PRIVATE-MSG", sender: "assistant", created_at: "2026-09-29T00:00:00Z", text: "PRIVATE-TEXT" }] }]));
  const config = { timeZone: "Asia/Shanghai", chatTextEstimates: true };
  assert.equal((await importChatInbox(root, config)).imports, 1);
  assert.equal((await importChatInbox(root, config)).unchanged, 1);
  const before = await fs.readFile(path.join(root, ".private", "claude-chat-ledger.json"), "utf8");
  assert.doesNotMatch(before, /PRIVATE/);
  await fs.writeFile(file, "malformed");
  assert.equal((await importChatInbox(root, config)).errors, 1);
  assert.equal(await fs.readFile(path.join(root, ".private", "claude-chat-ledger.json"), "utf8"), before);
});

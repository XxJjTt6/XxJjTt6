import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  normalizeUsage, codeRecord, aggregateCode, defaultCodeRoots, scanCodeRoots, tokscaleScanEnv
} from "../scripts/lib/claude-usage-v1.mjs";

function event(overrides = {}) {
  return {
    type: "assistant", timestamp: "2026-09-28T16:01:00.000Z", entrypoint: "claude-desktop", requestId: "req-a",
    message: { id: "msg-a", model: "claude-sonnet-4-6", content: [{ type: "text", text: "PRIVATE-CONTENT" }],
      usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 5 } },
    ...overrides
  };
}

test("streaming snapshots and cross-surface replays merge once per request", () => {
  const first = event();
  const final = event({ entrypoint: "vscode", message: { ...first.message, usage: { input_tokens: 0, output_tokens: 70, cache_read_input_tokens: 30 } } });
  const summary = aggregateCode([codeRecord(first), codeRecord(final), codeRecord(final)]);
  assert.equal(summary.totals.totalTokens, 205);
  assert.equal(summary.totals.messages, 1);
  assert.equal(summary.surfaces.shared.totalTokens, 205);
  assert.equal(summary.surfaces.vscode.totalTokens, 0);
  assert.equal(summary.daily[0].date, "2026-09-29");
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE-CONTENT|req-a|msg-a/);
});

test("same provider response remains deduplicated when transport request IDs change", () => {
  const summary = aggregateCode([codeRecord(event()), codeRecord(event({ requestId: "req-b" }))]);
  assert.equal(summary.totals.messages, 1);
});

test("missing entrypoint stays unattributed; explicit hints do not guess CLI", () => {
  const record = codeRecord(event({ entrypoint: undefined }));
  assert.deepEqual(record.surfaces, ["unknown"]);
  assert.deepEqual(codeRecord(event({ entrypoint: undefined }), { surface: "vscode" }).surfaces, ["vscode"]);
  assert.deepEqual(codeRecord(event({ entrypoint: "cli" })).surfaces, ["cli"]);
});

test("synthetic messages, bad dates and quota-only values are never counted as tokens", () => {
  assert.equal(normalizeUsage({ utilization: 50, total_tokens: 1000 }), null);
  assert.equal(normalizeUsage({ input_tokens: -1, output_tokens: 4 }), null);
  assert.equal(normalizeUsage({ input_tokens: "100", output_tokens: 4 }), null);
  assert.equal(normalizeUsage({ input_tokens: 1, output_tokens: NaN }), null);
  assert.equal(normalizeUsage({ input_tokens: null, output_tokens: 4 }), null);
  assert.equal(codeRecord(event({ timestamp: "invalid" })), null);
  const synthetic = event(); synthetic.message.model = "<synthetic>";
  assert.equal(codeRecord(synthetic), null);
});

test("roots cover Desktop Code and custom Claude config without scanning browser stores", () => {
  const roots = defaultCodeRoots({ home: "/test/home", env: { CLAUDE_CONFIG_DIR: "/custom/profile" }, platform: "darwin" });
  assert.ok(roots.some((root) => root.path === "/test/home/.claude/projects"));
  assert.ok(roots.some((root) => root.path === "/custom/profile/projects"));
  assert.ok(roots.some((root) => root.path.endsWith("Claude/claude-code-sessions")));
  assert.ok(roots.every((root) => !/IndexedDB|Cookies|local-agent-mode/.test(root.path)));
});

test("scanner tolerates an unfinished JSONL tail and deduplicates overlapping roots", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claude-scan-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const logs = path.join(root, "projects");
  await fs.mkdir(logs);
  await fs.writeFile(path.join(logs, "a.jsonl"), `${JSON.stringify(event())}\n{unfinished`);
  await fs.writeFile(path.join(logs, "not-a-session.json"), JSON.stringify(event()));
  const result = await scanCodeRoots([{ path: root, surface: "unknown" }, { path: logs, surface: "unknown" }, { path: path.join(root, "absent"), surface: "cli" }]);
  assert.equal(result.totals.messages, 1);
  assert.equal(result.diagnostics.filesScanned, 1);
  assert.equal(result.diagnostics.invalidLines, 1);
  assert.equal(result.diagnostics.missingRoots, 1);
});

test("extra paths reach Tokscale without replacing existing custom sources", () => {
  const env = tokscaleScanEnv(["/one path", "/one path", "/two"], { TOKSCALE_EXTRA_DIRS: "codex:/saved" });
  assert.equal(env.TOKSCALE_EXTRA_DIRS, "codex:/saved,claude:/one path,claude:/two");
  assert.throws(() => tokscaleScanEnv(["/unsafe,path"]), /commas/);
});

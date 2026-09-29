import test from "node:test";
import assert from "node:assert/strict";
import { buildSyncTokenV5Plan, SYNC_TOKEN_V5_GENERATED_PATHS, unrelatedDirtyPaths } from "../scripts/lib/sync-token-now-v5.mjs";
import { renderClaudeUsage } from "../scripts/lib/claude-usage-readme-v1.mjs";
import { aggregateCode } from "../scripts/lib/claude-usage-v1.mjs";
import { summarizeChat } from "../scripts/lib/claude-chat-v1.mjs";

test("v5 scans before upload and stages only approved aggregate files", () => {
  const plan = buildSyncTokenV5Plan();
  const scan = plan.findIndex((step) => step.args.includes("scripts/scan-claude-usage-v1.mjs"));
  const submit = plan.findIndex((step) => step.args.includes("submit"));
  assert.ok(scan < submit);
  assert.deepEqual(plan.find((step) => step.args[0] === "add").args, ["add", ...SYNC_TOKEN_V5_GENERATED_PATHS]);
  assert.ok(!SYNC_TOKEN_V5_GENERATED_PATHS.some((file) => file.includes(".private")));
  assert.ok(!SYNC_TOKEN_V5_GENERATED_PATHS.includes("assets"));
  assert.ok(plan.find((step) => step.args[0] === "commit").skipIfNoChanges);
  assert.ok(!plan.find((step) => step.args[0] === "pull").args.includes("theirs"));
  assert.deepEqual(plan.at(-1).args, ["push", "origin", "HEAD:main"]);
});

test("publication accepts prepared aggregates but rejects code edits, deletions and extra assets", () => {
  assert.deepEqual(unrelatedDirtyPaths(" M README.md\0?? data/claude-usage.json\0"), []);
  assert.deepEqual(unrelatedDirtyPaths(" M scripts/example.mjs\0?? assets/private.png\0 D README.md\0"), ["scripts/example.mjs", "assets/private.png", "README.md"]);
});

test("README makes missing Chat and unattributed sources explicit, no zero-usage claim", () => {
  const code = { ...aggregateCode([]), diagnostics: { invalidLines: 0, unreadableEntries: 0 } };
  const rendered = renderClaudeUsage({ generatedAt: "2026-09-29T00:00:00Z", timeZone: "Asia/Shanghai", code, chat: summarizeChat(null) });
  assert.match(rendered, /等待导入官方/);
  assert.match(rendered, /尚未发现可归属的记录/);
  assert.match(rendered, /不可获取/);
  assert.match(rendered, /不再次叠加/);
  assert.match(rendered, /不写入 Tokscale 排名/);
});

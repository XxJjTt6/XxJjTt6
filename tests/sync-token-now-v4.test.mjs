import test from "node:test";
import assert from "node:assert/strict";

import {
  SYNC_TOKEN_V4_GENERATED_PATHS,
  buildSyncTokenV4Plan
} from "../scripts/lib/sync-token-now-v4.mjs";

test("buildSyncTokenV4Plan scans DeepSeek before generating and pushing the combined profile", () => {
  const plan = buildSyncTokenV4Plan({
    remote: "origin",
    branch: "main",
    clients: "codex,claude",
    sessionsRoot: "/Users/test/.dsh/sessions",
    message: "chore: sync combined token usage"
  });

  assert.deepEqual(plan.map((step) => step.label), [
    "Fetch latest main",
    "Rebase local changes",
    "Scan provider-reported DeepSeek Desktop usage",
    "Submit local Codex and Claude usage",
    "Refresh public Tokscale profile data",
    "Write hourly sync snapshot",
    "Verify generated files",
    "Stage generated token profile files",
    "Commit combined token sync",
    "Rebase combined token sync before push",
    "Push combined token sync to GitHub"
  ]);
  assert.deepEqual(plan[2].args, [
    "scripts/scan-deepseek-desktop-usage-v1.mjs",
    "--sessions",
    "/Users/test/.dsh/sessions",
    "--out",
    "data/deepseek-desktop-usage.json"
  ]);
  assert.deepEqual(plan[4].fallback[1].args, [
    "scripts/generate-tokscale-profile.mjs",
    "--graph",
    "data/tokscale-graph.json",
    "--deepseek",
    "data/deepseek-desktop-usage.json"
  ]);
  assert.deepEqual(plan[7].args, ["add", ...SYNC_TOKEN_V4_GENERATED_PATHS]);
  assert.deepEqual(plan[8].args, ["commit", "-m", "chore: sync combined token usage"]);
});

test("v4 staging remains scoped to generated profile artifacts", () => {
  assert.deepEqual(SYNC_TOKEN_V4_GENERATED_PATHS, [
    "README.md",
    "README.tokscale-v3.md",
    "assets",
    "data/tokscale-graph.json",
    "data/tokscale-summary.json",
    "data/tokscale-hourly-sync.json",
    "data/deepseek-desktop-usage.json"
  ]);
});

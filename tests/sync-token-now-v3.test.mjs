import test from "node:test";
import assert from "node:assert/strict";

import {
  SYNC_TOKEN_GENERATED_PATHS,
  buildSyncTokenPlan
} from "../scripts/lib/sync-token-now-v3.mjs";

test("buildSyncTokenPlan wires the one-shot token sync and push sequence", () => {
  const plan = buildSyncTokenPlan({
    remote: "origin",
    branch: "main",
    clients: "codex,claude",
    message: "chore: sync Tokscale token usage"
  });

  assert.deepEqual(plan.map((step) => step.label), [
    "Fetch latest main",
    "Rebase local changes",
    "Submit local Codex and Claude usage",
    "Refresh public Tokscale profile data",
    "Write hourly sync snapshot",
    "Verify generated files",
    "Stage generated token profile files",
    "Commit token sync",
    "Rebase token sync before push",
    "Push token sync to GitHub"
  ]);

  assert.deepEqual(plan[2], {
    label: "Submit local Codex and Claude usage",
    command: "npx",
    args: ["-y", "tokscale@latest", "submit", "--client", "codex,claude"]
  });

  assert.deepEqual(plan[6].args, ["add", ...SYNC_TOKEN_GENERATED_PATHS]);
  assert.deepEqual(plan[7].args, ["commit", "-m", "chore: sync Tokscale token usage"]);
  assert.deepEqual(plan[8].args, ["pull", "--rebase", "-X", "theirs", "origin", "main"]);
  assert.deepEqual(plan[9].args, ["push", "origin", "main"]);
});

test("generated token profile paths are intentionally scoped", () => {
  assert.deepEqual(SYNC_TOKEN_GENERATED_PATHS, [
    "README.md",
    "README.tokscale-v3.md",
    "assets",
    "data/tokscale-graph.json",
    "data/tokscale-summary.json",
    "data/tokscale-hourly-sync.json"
  ]);
});

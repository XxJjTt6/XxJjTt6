import { buildSyncTokenV4Plan, SYNC_TOKEN_V4_GENERATED_PATHS } from "./sync-token-now-v4.mjs";

export const SYNC_TOKEN_V5_GENERATED_PATHS = [
  ...SYNC_TOKEN_V4_GENERATED_PATHS.filter((file) => file !== "assets"),
  "assets/tokscale-ai-usage-card.svg", "assets/tokscale-ai-token-heatmap.svg", "data/claude-usage.json"
];

export function unrelatedDirtyPaths(porcelain) {
  const entries = porcelain.split("\0").filter(Boolean);
  const dirty = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const file = entry.slice(3);
    if (!SYNC_TOKEN_V5_GENERATED_PATHS.includes(file) || /[RD]/.test(entry.slice(0, 2))) dirty.push(file);
    if (entry.slice(0, 2).includes("R")) index += 1;
  }
  return dirty;
}

export function buildSyncTokenV5Plan(options = {}) {
  const plan = buildSyncTokenV4Plan(options);
  plan.splice(3, 0, {
    label: "Scan Claude Desktop Code, VS Code, CLI and imported Chat usage",
    command: "node", args: ["scripts/scan-claude-usage-v1.mjs"]
  });
  for (const step of plan) {
    if (step.command === "git" && step.args[0] === "add") step.args = ["add", ...SYNC_TOKEN_V5_GENERATED_PATHS];
    if (step.command === "git" && step.args[0] === "commit") step.skipIfNoChanges = true;
    if (step.command === "git" && step.args[0] === "push") step.args = ["push", options.remote ?? "origin", `HEAD:${options.branch ?? "main"}`];
    // Conflicts must stop the sync, never silently prefer one side's statistics.
    if (step.command === "git" && step.args[0] === "pull") step.args = ["pull", "--rebase", options.remote ?? "origin", options.branch ?? "main"];
  }
  return plan;
}

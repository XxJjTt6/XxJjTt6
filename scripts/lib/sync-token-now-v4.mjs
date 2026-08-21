import os from "node:os";
import path from "node:path";

export const SYNC_TOKEN_V4_GENERATED_PATHS = [
  "README.md",
  "README.tokscale-v3.md",
  "assets",
  "data/tokscale-graph.json",
  "data/tokscale-summary.json",
  "data/tokscale-hourly-sync.json",
  "data/deepseek-desktop-usage.json"
];

export function buildSyncTokenV4Plan({
  remote = "origin",
  branch = "main",
  clients = "codex,claude",
  sessionsRoot = path.join(os.homedir(), ".dsh", "sessions"),
  message = "chore: sync Codex, Claude, and DeepSeek token usage"
} = {}) {
  return [
    {
      label: "Fetch latest main",
      command: "git",
      args: ["fetch", remote, branch],
      timeoutMs: 120000
    },
    {
      label: "Rebase local changes",
      command: "git",
      args: ["rebase", `${remote}/${branch}`]
    },
    {
      label: "Scan provider-reported DeepSeek Desktop usage",
      command: "node",
      args: [
        "scripts/scan-deepseek-desktop-usage-v1.mjs",
        "--sessions",
        sessionsRoot,
        "--out",
        "data/deepseek-desktop-usage.json"
      ]
    },
    {
      label: "Submit local Codex and Claude usage",
      command: "npx",
      args: ["-y", "tokscale@latest", "submit", "--client", clients],
      timeoutMs: 180000
    },
    {
      label: "Refresh public Tokscale profile data",
      command: "npm",
      args: ["run", "refresh:public"],
      timeoutMs: 120000,
      retry: {
        attempts: 8,
        delayMs: 15000
      },
      fallback: [
        {
          label: "Export local Tokscale graph data",
          command: "npx",
          args: ["-y", "tokscale@latest", "graph", "--client", clients, "--no-spinner", "--output", "data/tokscale-graph.json"],
          timeoutMs: 180000
        },
        {
          label: "Generate combined profile from local usage",
          command: "node",
          args: [
            "scripts/generate-tokscale-profile.mjs",
            "--graph",
            "data/tokscale-graph.json",
            "--deepseek",
            "data/deepseek-desktop-usage.json"
          ]
        }
      ]
    },
    {
      label: "Write hourly sync snapshot",
      command: "npm",
      args: ["run", "sync:hourly"]
    },
    {
      label: "Verify generated files",
      command: "npm",
      args: ["test"]
    },
    {
      label: "Stage generated token profile files",
      command: "git",
      args: ["add", ...SYNC_TOKEN_V4_GENERATED_PATHS]
    },
    {
      label: "Commit combined token sync",
      command: "git",
      args: ["commit", "-m", message]
    },
    {
      label: "Rebase combined token sync before push",
      command: "git",
      args: ["pull", "--rebase", "-X", "theirs", remote, branch],
      timeoutMs: 120000
    },
    {
      label: "Push combined token sync to GitHub",
      command: "git",
      args: ["push", remote, branch],
      timeoutMs: 120000
    }
  ];
}

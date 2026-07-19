export const SYNC_TOKEN_GENERATED_PATHS = [
  "README.md",
  "README.tokscale-v3.md",
  "assets",
  "data/tokscale-graph.json",
  "data/tokscale-summary.json",
  "data/tokscale-hourly-sync.json"
];

export function buildSyncTokenPlan({
  remote = "origin",
  branch = "main",
  clients = "codex,claude",
  message = "chore: sync Tokscale token usage"
} = {}) {
  return [
    {
      label: "Fetch latest main",
      command: "git",
      args: ["fetch", remote, branch]
    },
    {
      label: "Rebase local changes",
      command: "git",
      args: ["rebase", `${remote}/${branch}`]
    },
    {
      label: "Submit local Codex and Claude usage",
      command: "npx",
      args: ["-y", "tokscale@latest", "submit", "--client", clients]
    },
    {
      label: "Refresh public Tokscale profile data",
      command: "npm",
      args: ["run", "refresh:public"],
      retry: {
        attempts: 8,
        delayMs: 15000
      },
      fallback: [
        {
          label: "Export local Tokscale graph data",
          command: "npx",
          args: ["-y", "tokscale@latest", "graph", "--client", clients, "--no-spinner", "--output", "data/tokscale-graph.json"]
        },
        {
          label: "Generate profile files from local Tokscale graph",
          command: "node",
          args: ["scripts/generate-tokscale-profile.mjs", "--graph", "data/tokscale-graph.json"]
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
      args: ["add", ...SYNC_TOKEN_GENERATED_PATHS]
    },
    {
      label: "Commit token sync",
      command: "git",
      args: ["commit", "-m", message]
    },
    {
      label: "Rebase token sync before push",
      command: "git",
      args: ["pull", "--rebase", "-X", "theirs", remote, branch]
    },
    {
      label: "Push token sync to GitHub",
      command: "git",
      args: ["push", remote, branch]
    }
  ];
}

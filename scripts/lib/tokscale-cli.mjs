import path from "node:path";
import { todayInTimeZone } from "./date.mjs";

export const DEFAULT_CLIENTS = "codex,claude";
export const DEFAULT_SINCE = "2026-01-01";

export function parseUpdateArgs(args) {
  const parsed = {
    clients: DEFAULT_CLIENTS,
    since: DEFAULT_SINCE,
    until: todayInTimeZone("Asia/Shanghai"),
    profileName: "XxJjTt6",
    handle: "@XxJjTt6",
    rankText: "Private"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--client") {
      parsed.clients = next;
      index += 1;
    } else if (arg === "--since") {
      parsed.since = next;
      index += 1;
    } else if (arg === "--until") {
      parsed.until = next;
      index += 1;
    } else if (arg === "--out") {
      parsed.outDir = next;
      index += 1;
    } else if (arg === "--home") {
      parsed.homeDir = next;
      index += 1;
    } else if (arg === "--name") {
      parsed.profileName = next;
      index += 1;
    } else if (arg === "--handle") {
      parsed.handle = next;
      index += 1;
    } else if (arg === "--rank") {
      parsed.rankText = next;
      index += 1;
    }
  }

  return parsed;
}

export function buildTokscaleGraphCommand(options) {
  const outDir = path.resolve(options.outDir ?? process.cwd());
  const graphPath = path.join(outDir, "data", "tokscale-graph.json");
  const args = [
    "-y",
    "tokscale@latest",
    "graph",
    "--client",
    options.clients ?? DEFAULT_CLIENTS,
    "--since",
    options.since ?? DEFAULT_SINCE,
    "--until",
    options.until,
    "--no-spinner",
    "--output",
    graphPath
  ];

  if (options.homeDir) {
    args.push("--home", path.resolve(options.homeDir));
  }

  return {
    command: "npx",
    args,
    graphPath
  };
}

export function buildGenerateProfileCommand(options) {
  const outDir = path.resolve(options.outDir ?? process.cwd());
  return {
    command: process.execPath,
    args: [
      path.join(outDir, "scripts", "generate-tokscale-profile.mjs"),
      "--graph",
      path.join(outDir, "data", "tokscale-graph.json"),
      "--out",
      outDir,
      "--name",
      options.profileName ?? "XxJjTt6",
      "--handle",
      options.handle ?? "@XxJjTt6",
      "--rank",
      options.rankText ?? "Private"
    ]
  };
}

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildGenerateProfileCommand, buildTokscaleGraphCommand, parseUpdateArgs } from "./lib/tokscale-cli.mjs";
import { readLocalConfig, tokscaleScanEnv } from "./lib/claude-usage-v1.mjs";
import { scanClaudeUsage } from "./scan-claude-usage-v1.mjs";

const options = parseUpdateArgs(process.argv.slice(2));
const config = await readLocalConfig(process.cwd());
const env = tokscaleScanEnv(config.roots);
// A --home override is an explicit different machine/archive; do not mix host logs into it.
if (!options.homeDir && process.env.GITHUB_ACTIONS !== "true" && process.env.CI !== "true") await scanClaudeUsage(process.cwd());
const graph = buildTokscaleGraphCommand(options);
fs.mkdirSync(path.dirname(graph.graphPath), { recursive: true });

run(graph.command, graph.args);
const generate = buildGenerateProfileCommand(options);
run(generate.command, generate.args);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: options.homeDir ? process.env : env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

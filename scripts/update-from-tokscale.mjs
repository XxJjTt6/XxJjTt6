#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildGenerateProfileCommand, buildTokscaleGraphCommand, parseUpdateArgs } from "./lib/tokscale-cli.mjs";

const options = parseUpdateArgs(process.argv.slice(2));
const graph = buildTokscaleGraphCommand(options);
fs.mkdirSync(path.dirname(graph.graphPath), { recursive: true });

run(graph.command, graph.args);
const generate = buildGenerateProfileCommand(options);
run(generate.command, generate.args);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

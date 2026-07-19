#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

import { buildHourlySyncSnapshot } from "./lib/tokscale-hourly-sync-v2.mjs";

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] || fallback;
}

const graphPath = readOption("--graph", "data/tokscale-graph.json");
const outPath = readOption("--out", "data/tokscale-hourly-sync.json");

const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const snapshot = buildHourlySyncSnapshot({ graph });

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`Hourly Tokscale sync snapshot written to ${outPath}`);

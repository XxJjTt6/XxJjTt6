#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fetchTokscalePublicGraph } from "./lib/tokscale-public-profile.mjs";

const options = parseArgs(process.argv.slice(2));
const username = options.username ?? "XxJjTt6";
const outPath = path.resolve(options.outPath ?? path.join(process.cwd(), "data", "tokscale-graph.json"));

const graph = await fetchTokscalePublicGraph({ username });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(graph, null, 2)}\n`);

console.log(`Fetched public Tokscale profile for ${username}`);
console.log(`Graph written to ${outPath}`);
console.log(`Rank: ${graph.profile.rankText}`);
console.log(`Tokens: ${graph.summary.totalTokens.toLocaleString("en-US")}`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--username") {
      parsed.username = next;
      index += 1;
    } else if (arg === "--out") {
      parsed.outPath = next;
      index += 1;
    }
  }
  return parsed;
}

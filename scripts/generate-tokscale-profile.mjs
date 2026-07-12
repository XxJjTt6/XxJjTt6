#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  renderTokscaleCard,
  renderTokscaleHeatmap,
  renderTokscaleReadme,
  summarizeTokscaleGraph
} from "./lib/tokscale-profile.mjs";

const options = parseArgs(process.argv.slice(2));
const outDir = path.resolve(options.outDir ?? process.cwd());
const graphPath = path.resolve(options.graphPath ?? path.join(outDir, "data", "tokscale-graph.json"));
const profileName = options.profileName ?? "XxJjTt6";
const handle = options.handle ?? "@XxJjTt6";
const rankText = options.rankText ?? "Submit for rank";

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const summary = summarizeTokscaleGraph(graph);

fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
fs.mkdirSync(path.join(outDir, "data"), { recursive: true });
fs.writeFileSync(path.join(outDir, "data", "tokscale-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, "assets", "tokscale-ai-usage-card.svg"),
  renderTokscaleCard({ summary, profileName, handle, rankText })
);
fs.writeFileSync(path.join(outDir, "assets", "tokscale-ai-token-heatmap.svg"), renderTokscaleHeatmap(summary));
fs.writeFileSync(path.join(outDir, "README.md"), renderTokscaleReadme({ summary, profileName, handle }));
fs.writeFileSync(path.join(outDir, "README.tokscale-v3.md"), renderTokscaleReadme({ summary, profileName, handle }));

console.log(`Generated Tokscale profile files in ${outDir}`);
console.log(`Tokens: ${summary.totals.totalTokens.toLocaleString("en-US")}`);
console.log(`Cost: $${summary.totals.totalCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--graph") {
      parsed.graphPath = next;
      index += 1;
    } else if (arg === "--out") {
      parsed.outDir = next;
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

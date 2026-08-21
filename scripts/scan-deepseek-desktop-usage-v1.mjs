#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scanDeepSeekDesktopUsage } from "./lib/deepseek-desktop-usage-v1.mjs";

const options = parseArgs(process.argv.slice(2));
const sessionsRoot = path.resolve(options.sessionsRoot ?? path.join(os.homedir(), ".dsh", "sessions"));
const outPath = path.resolve(options.outPath ?? path.join(process.cwd(), "data", "deepseek-desktop-usage.json"));

const snapshot = await scanDeepSeekDesktopUsage({
  sessionsRoot,
  generatedAt: options.generatedAt ?? new Date(),
  timeZone: options.timeZone ?? "Asia/Shanghai",
  zstdcatPath: options.zstdcatPath
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`Scanned ${snapshot.sessionsScanned} DeepSeek Desktop sessions.`);
console.log(`Provider-reported usage samples: ${snapshot.usageSamples.toLocaleString("en-US")}`);
console.log(`Tokens: ${snapshot.totals.totalTokens.toLocaleString("en-US")}`);
console.log(`Snapshot written to ${outPath}`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--sessions") {
      parsed.sessionsRoot = next;
      index += 1;
    } else if (arg === "--out") {
      parsed.outPath = next;
      index += 1;
    } else if (arg === "--time-zone") {
      parsed.timeZone = next;
      index += 1;
    } else if (arg === "--zstdcat") {
      parsed.zstdcatPath = next;
      index += 1;
    } else if (arg === "--now") {
      parsed.generatedAt = next;
      index += 1;
    }
  }
  return parsed;
}

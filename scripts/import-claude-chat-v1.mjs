#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseChatExport, mergeChatImports } from "./lib/claude-chat-v1.mjs";
import { readLocalConfig, writeJsonAtomic } from "./lib/claude-usage-v1.mjs";
import { acquireLock } from "./lib/claude-collector-v6.mjs";
import { scanClaudeUsage } from "./scan-claude-usage-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const file = args[0];
if (!file || file.startsWith("--") || args.slice(1).some((arg) => arg !== "--no-estimates")) {
  throw new Error("Usage: npm run import:claude-chat -- /absolute/path/conversations.json|export.zip [--no-estimates]");
}
const config = await readLocalConfig(root);
const source = path.resolve(file);
const limit = 128 * 1024 * 1024;
let text;
if (source.toLowerCase().endsWith(".zip")) {
  // Read only conversations.json into memory; never extract arbitrary archive paths.
  text = execFileSync("python3", ["-c", `
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    matches = [item for item in archive.infolist() if item.filename.replace('\\\\','/').split('/')[-1] == 'conversations.json']
    if len(matches) != 1: raise ValueError('Expected exactly one conversations.json in export ZIP')
    if matches[0].file_size > 128 * 1024 * 1024: raise ValueError('Chat export exceeds 128 MiB limit')
    sys.stdout.buffer.write(archive.read(matches[0]))
`, source], { encoding: "utf8", maxBuffer: limit, timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
} else {
  if ((await fs.stat(source)).size > limit) throw new Error("Chat export exceeds 128 MiB limit.");
  text = await fs.readFile(source, "utf8");
}
const incoming = parseChatExport(JSON.parse(text.replace(/^\uFEFF/, "")), {
  timeZone: config.timeZone,
  estimateText: config.chatTextEstimates && !args.includes("--no-estimates")
});
if (!incoming.records.length) throw new Error("No messages with stable IDs found; nothing was imported.");
const ledgerPath = path.join(root, ".private", "claude-chat-ledger.json");
const release = await acquireLock(root);
try {
let previous = null;
try { previous = JSON.parse(await fs.readFile(ledgerPath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const ledger = mergeChatImports(previous, incoming);
await writeJsonAtomic(ledgerPath, ledger, { privateFile: true });
console.log(`Imported ${incoming.records.length} message observations; ${ledger.records.length} unique messages retained. Chat text was not saved.`);
} finally { await release(); }
await scanClaudeUsage(root);
execFileSync(process.execPath, [path.join(root, "scripts", "generate-tokscale-profile.mjs"), "--out", root], { cwd: root, stdio: "inherit" });

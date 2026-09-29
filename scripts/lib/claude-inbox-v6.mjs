import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseChatExport, mergeChatImports } from "./claude-chat-v1.mjs";
import { hashId, writeJsonAtomic } from "./claude-usage-v1.mjs";
import { readJson } from "./claude-collector-v6.mjs";

export async function importChatInbox(root, config) {
  const inbox = path.join(root, ".private", "chat-imports");
  await fs.mkdir(inbox, { recursive: true, mode: 0o700 });
  const manifestFile = path.join(root, ".private", "chat-import-manifest.json");
  const ledgerFile = path.join(root, ".private", "claude-chat-ledger.json");
  const manifest = await readJson(manifestFile, {});
  let ledger = await readJson(ledgerFile);
  const health = { imports: 0, unchanged: 0, errors: 0 };
  for (const entry of await fs.readdir(inbox, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(json|zip)$/i.test(entry.name)) continue;
    const file = path.join(inbox, entry.name);
    try {
      const stat = await fs.stat(file);
      if (stat.size > 128 * 1024 * 1024) throw new Error("too large");
      const bytes = await fs.readFile(file);
      const id = hashId(bytes);
      if (manifest[id]) { health.unchanged += 1; continue; }
      const text = /\.zip$/i.test(entry.name) ? execFileSync("python3", ["-c", `
import sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    matches=[i for i in z.infolist() if i.filename.replace('\\\\','/').split('/')[-1]=='conversations.json']
    if len(matches)!=1 or matches[0].file_size>128*1024*1024: raise ValueError('Invalid export')
    sys.stdout.buffer.write(z.read(matches[0]))
`, file], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 60000, stdio: ["ignore", "pipe", "pipe"] }) : bytes.toString("utf8");
      const incoming = parseChatExport(JSON.parse(text.replace(/^\uFEFF/, "")), { timeZone: config.timeZone, estimateText: config.chatTextEstimates });
      if (!incoming.records.length) throw new Error("no messages");
      ledger = mergeChatImports(ledger, incoming);
      // Persist ledger before marking the content imported: crash recovery is idempotent.
      await writeJsonAtomic(ledgerFile, ledger, { privateFile: true });
      manifest[id] = new Date().toISOString();
      await writeJsonAtomic(manifestFile, manifest, { privateFile: true });
      health.imports += 1;
    } catch { health.errors += 1; }
  }
  return health;
}

#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLocalConfig, scanCodeRoots, writeJsonAtomic } from "./lib/claude-usage-v1.mjs";
import { summarizeChat } from "./lib/claude-chat-v1.mjs";
import { importChatInbox } from "./lib/claude-inbox-v6.mjs";
import { readJson, mergeLedger, summarizeLedger, scanDesktop, acquireLock } from "./lib/claude-collector-v6.mjs";

export async function scanClaudeUsage(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const release = await acquireLock(root);
  try {
    const config = await readLocalConfig(root);
    const { existingRoots, records, ...code } = await scanCodeRoots(config.roots, config);
    const desktop = scanDesktop(root, config);
    const ledgerFile = path.join(root, ".private", "claude-numeric-ledger-v6.json");
    const ledger = mergeLedger(await readJson(ledgerFile), [...records, ...desktop.records], config.timeZone);
    await writeJsonAtomic(ledgerFile, ledger, { privateFile: true });
    const inbox = await importChatInbox(root, config);
    const chatLedger = await readJson(path.join(root, ".private", "claude-chat-ledger.json"));
    if (chatLedger && chatLedger.timeZone !== config.timeZone) throw new Error("Chat ledger timezone differs from scan configuration.");
    const { records: discarded, ...desktopHealth } = desktop;
    const snapshot = {
      schemaVersion: "claude-surfaces-v6", generatedAt: new Date().toISOString(), timeZone: config.timeZone,
      code, inbox, observedClaude: summarizeLedger(ledger), desktop: desktopHealth,
      chat: summarizeChat(chatLedger, { estimateText: config.chatTextEstimates })
    };
    snapshot.health = {
      status: inbox.errors || desktop.diagnostics.unsupportedTrees || desktop.status === "error" || code.diagnostics.unreadableEntries || code.diagnostics.invalidLines ? "degraded" : "partial",
      fullAccountCoverage: false,
      issues: [
        ...(desktop.diagnostics.unsupportedTrees ? ["DESKTOP_FORMAT_UNSUPPORTED"] : []),
        ...(inbox.errors ? ["CHAT_IMPORT_ERROR"] : []),
        ...(desktop.status === "error" ? ["DESKTOP_COLLECTOR_ERROR"] : []),
        ...(code.diagnostics.unreadableEntries || code.diagnostics.invalidLines ? ["TRANSCRIPT_READ_ERRORS"] : []),
        ...(desktop.diagnostics.conversationsWithOlderUncachedMessages ? ["DESKTOP_HISTORY_PARTIAL"] : []),
        ...(!chatLedger ? ["CHAT_EXPORT_REQUIRED"] : snapshot.chat.repliesWithoutUsage ? ["CHAT_USAGE_UNAVAILABLE"] : []),
        ...["cli", "vscode", "desktop-code"].filter((s) => snapshot.observedClaude.coverage[s].status === "not-observed").map((s) => `${s.toUpperCase()}_NOT_OBSERVED`)
      ]
    };
    await writeJsonAtomic(path.join(root, "data", "claude-usage.json"), snapshot);
    console.log(`Claude: ${snapshot.observedClaude.totals.messages} retained unique messages; ${snapshot.observedClaude.totals.totalTokens} observed tokens; coverage=${snapshot.health.status}.`);
    console.log(`Desktop=${desktop.status}; Chat=${snapshot.chat.status}; issues=${snapshot.health.issues.join(",") || "none"}.`);
    return { snapshot, existingRoots };
  } finally { await release(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error("scan:claude takes no arguments; use .private/claude-usage.local.json.");
  const { snapshot } = await scanClaudeUsage();
  if (snapshot.health.status === "degraded") process.exitCode = 2;
}

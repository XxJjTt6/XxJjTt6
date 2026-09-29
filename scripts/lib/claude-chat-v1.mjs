import { hashId, normalizeUsage, dateInZone, bucket } from "./claude-usage-v1.mjs";

export const CHAT_ESTIMATOR = "visible-text-heuristic-v1";

export function estimateVisibleTextTokens(text) {
  // A transparent text-volume heuristic, NOT a Claude tokenizer or an inference bill.
  const characters = [...text];
  const ascii = characters.filter((character) => character.codePointAt(0) <= 127).length;
  return Math.ceil(ascii / 4 + characters.length - ascii);
}

function visibleText(message) {
  if (typeof message.text === "string" && message.text.length) return message.text;
  return (Array.isArray(message.content) ? message.content : [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text).join("\n");
}

export function parseChatExport(data, { timeZone = "Asia/Shanghai", estimateText = true } = {}) {
  const conversations = Array.isArray(data) ? data : data?.conversations;
  if (!Array.isArray(conversations)) throw new TypeError("Expected Claude conversations.json (an array or { conversations: [...] }).");
  const diagnostics = { conversations: 0, missingIds: 0, missingDates: 0, invalidUsage: 0, unsupportedMessages: 0 };
  const records = [];
  for (const conversation of conversations) {
    if (!Array.isArray(conversation?.chat_messages)) continue;
    diagnostics.conversations += 1;
    const conversationId = conversation.uuid ?? conversation.id;
    for (const message of conversation.chat_messages) {
      const messageId = message?.uuid ?? message?.id;
      if (!conversationId || !messageId) { diagnostics.missingIds += 1; continue; }
      const role = message.sender === "human" || message.role === "user" ? "user"
        : message.sender === "assistant" || message.role === "assistant" ? "assistant" : null;
      if (!role) { diagnostics.unsupportedMessages += 1; continue; }
      const date = dateInZone(message.created_at ?? message.timestamp, timeZone);
      if (!date) diagnostics.missingDates += 1;
      const rawUsage = message.usage ?? message.token_usage;
      const usage = role === "assistant" ? normalizeUsage(rawUsage) : null;
      if (rawUsage && !usage) diagnostics.invalidUsage += 1;
      const text = visibleText(message);
      records.push({
        id: hashId(`claude-chat:${conversationId}:${messageId}`), date, role,
        usage, visibleTextTokensEstimate: estimateText && text.length ? estimateVisibleTextTokens(text) : null,
        hasAttachments: Boolean(message.attachments?.length || message.files?.length || message.content?.some?.((part) => ["image", "document"].includes(part.type)))
      });
    }
  }
  if (!diagnostics.conversations) throw new Error("No Claude chat_messages arrays found; refusing an unrelated JSON file.");
  return { schemaVersion: "claude-chat-import-v1", timeZone, estimator: estimateText ? CHAT_ESTIMATOR : null, diagnostics, records };
}

export function mergeChatImports(previous, incoming) {
  if (previous && previous.timeZone !== incoming.timeZone) throw new Error("Chat timezone changed; reimport into a new ledger to avoid shifting daily history.");
  const records = new Map((previous?.records ?? []).map((record) => [record.id, record]));
  for (const record of incoming.records) {
    const old = records.get(record.id);
    // A newer complete export replaces that message; missing usage never erases real usage.
    records.set(record.id, { ...record, usage: record.usage ?? old?.usage ?? null });
  }
  return {
    schemaVersion: "claude-chat-ledger-v1", timeZone: incoming.timeZone,
    estimator: incoming.estimator, lastImportedAt: new Date().toISOString(),
    lastImportDiagnostics: incoming.diagnostics,
    records: [...records.values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}

export function summarizeChat(ledger, { estimateText = true } = {}) {
  const records = ledger?.records ?? [];
  const measured = records.filter((record) => record.usage);
  const estimated = estimateText ? records.filter((record) => record.visibleTextTokensEstimate !== null) : [];
  const dates = [...new Set(records.map((record) => record.date).filter(Boolean))].sort();
  return {
    status: !ledger ? "awaiting-export" : measured.length ? "imported-with-usage" : "imported-without-usage",
    scope: "Claude account Chat export; desktop/web/mobile cannot be distinguished unless the export identifies them. Excludes Code.",
    lastImportedAt: ledger?.lastImportedAt ?? null,
    messages: records.length,
    messagesWithAttachments: records.filter((record) => record.hasAttachments).length,
    undatedMessages: records.filter((record) => !record.date).length,
    measuredReplies: measured.length,
    repliesWithoutUsage: records.filter((record) => record.role === "assistant" && !record.usage).length,
    reportedTokens: measured.length ? bucket(measured.map((record) => record.usage)) : null,
    textEstimate: !estimated.length ? null : {
      method: CHAT_ESTIMATOR, messages: estimated.length,
      tokens: estimated.reduce((sum, record) => sum + record.visibleTextTokensEstimate, 0),
      limitation: "Visible text counted once; excludes repeated context, system prompts, hidden reasoning, tools and attachments. Not billed tokens, not a lower bound. Never added to actual usage or submitted to Tokscale."
    },
    daily: dates.map((date) => {
      const day = records.filter((record) => record.date === date);
      const actual = day.filter((record) => record.usage);
      const text = estimateText ? day.filter((record) => record.visibleTextTokensEstimate !== null) : [];
      return {
        date, messages: day.length,
        reportedTokens: actual.length ? bucket(actual.map((record) => record.usage)).totalTokens : null,
        visibleTextTokensEstimate: text.length ? text.reduce((sum, record) => sum + record.visibleTextTokensEstimate, 0) : null
      };
    }),
    diagnostics: ledger?.lastImportDiagnostics ?? null
  };
}

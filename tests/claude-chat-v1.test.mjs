import test from "node:test";
import assert from "node:assert/strict";
import { parseChatExport, mergeChatImports, summarizeChat } from "../scripts/lib/claude-chat-v1.mjs";

function chat(usage) {
  return [{ uuid: "conversation-private", name: "PRIVATE-TITLE", chat_messages: [
    { uuid: "user-private", sender: "human", created_at: "2026-09-28T16:01:00Z", text: "PRIVATE-QUESTION" },
    { uuid: "reply-private", sender: "assistant", created_at: "2026-09-28T16:02:00Z", text: "PRIVATE-ANSWER", usage }
  ] }];
}

test("ordinary exports give isolated text estimates, never fake measured consumption", () => {
  const ledger = mergeChatImports(null, parseChatExport(chat()));
  const summary = summarizeChat(ledger);
  assert.equal(summary.reportedTokens, null);
  assert.equal(summary.status, "imported-without-usage");
  assert.ok(summary.textEstimate.tokens > 0);
  assert.equal(summary.daily[0].date, "2026-09-29");
  assert.equal(summary.repliesWithoutUsage, 1);
  assert.doesNotMatch(JSON.stringify(ledger), /PRIVATE-|conversation-private|user-private|reply-private/);
});

test("repeated imports do not grow totals and later real usage supersedes missing usage", () => {
  const first = parseChatExport(chat());
  let ledger = mergeChatImports(null, first);
  ledger = mergeChatImports(ledger, first);
  assert.equal(ledger.records.length, 2);
  ledger = mergeChatImports(ledger, parseChatExport(chat({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 })));
  ledger = mergeChatImports(ledger, first);
  const summary = summarizeChat(ledger);
  assert.equal(summary.reportedTokens.totalTokens, 170);
  assert.equal(summary.measuredReplies, 1);
  assert.equal(summary.repliesWithoutUsage, 0);
  assert.ok(summary.textEstimate.tokens < 170);
});

test("estimates can be disabled at import and rendering time", () => {
  const parsed = parseChatExport(chat(), { estimateText: false });
  assert.ok(parsed.records.every((record) => record.visibleTextTokensEstimate === null));
  const ledger = mergeChatImports(null, parseChatExport(chat()));
  assert.equal(summarizeChat(ledger, { estimateText: false }).textEstimate, null);
});

test("unrelated quota data is rejected and malformed usage is not treated as zero", () => {
  assert.throws(() => parseChatExport({ version: 2, samples: [{ u: { fh: 80, sd: 90 } }] }), /conversations/);
  assert.throws(() => parseChatExport([{ name: "not a chat" }]), /chat_messages/);
  const parsed = parseChatExport(chat({ total_tokens: 400 }));
  assert.equal(parsed.diagnostics.invalidUsage, 1);
  assert.equal(summarizeChat(mergeChatImports(null, parsed)).reportedTokens, null);
});

test("absent source differs from a measured zero and missing dates are explicit", () => {
  assert.equal(summarizeChat(null).status, "awaiting-export");
  const data = chat({ input_tokens: 0, output_tokens: 0 });
  delete data[0].chat_messages[1].created_at;
  const summary = summarizeChat(mergeChatImports(null, parseChatExport(data)));
  assert.equal(summary.reportedTokens.totalTokens, 0);
  assert.equal(summary.undatedMessages, 1);
});

test("missing IDs do not use content as identity; timezone changes require explicit reimport", () => {
  const data = chat(); delete data[0].chat_messages[0].uuid;
  assert.equal(parseChatExport(data).diagnostics.missingIds, 1);
  const ledger = mergeChatImports(null, parseChatExport(chat()));
  assert.throws(() => mergeChatImports(ledger, parseChatExport(chat(), { timeZone: "UTC" })), /timezone/);
});

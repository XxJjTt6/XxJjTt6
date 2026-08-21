import test from "node:test";
import assert from "node:assert/strict";

import { summarizeDeepSeekSessions } from "../scripts/lib/deepseek-desktop-usage-v1.mjs";

test("summarizeDeepSeekSessions uses final usage once and preserves failed-step chunks", () => {
  const snapshot = summarizeDeepSeekSessions({
    generatedAt: "2026-08-21T12:00:00.000Z",
    timeZone: "Asia/Shanghai",
    sessions: [
      {
        sessionId: "session-a",
        events: [
          context("deepseek-v4-flash", "2026-08-20T16:29:00.000Z"),
          usageChunk({
            turn: 1,
            step: 1,
            time: "2026-08-20T16:30:00.000Z",
            inputTokens: 100,
            outputTokens: 20,
            cacheReadTokens: 30,
            reasoningTokens: 10
          }),
          assistantMessage({
            turn: 1,
            step: 1,
            time: "2026-08-20T16:30:01.000Z",
            inputTokens: 110,
            outputTokens: 25,
            cacheReadTokens: 35,
            reasoningTokens: 12
          }),
          context("deepseek-v4-pro", "2026-08-21T01:00:00.000Z"),
          usageChunk({
            turn: 1,
            step: 2,
            time: "2026-08-21T01:01:00.000Z",
            inputTokens: 200,
            outputTokens: 10,
            cacheReadTokens: 40,
            cacheWriteTokens: 5,
            reasoningTokens: 6
          })
        ]
      }
    ]
  });

  assert.equal(snapshot.sessionsScanned, 1);
  assert.equal(snapshot.usageSamples, 2);
  assert.equal(snapshot.totals.totalTokens, 425);
  assert.equal(snapshot.totals.inputTokens, 310);
  assert.equal(snapshot.totals.outputTokens, 35);
  assert.equal(snapshot.totals.cacheReadTokens, 75);
  assert.equal(snapshot.totals.cacheWriteTokens, 5);
  assert.equal(snapshot.totals.reasoningTokens, 18);
  assert.equal(snapshot.totals.requests, 2);
  assert.equal(snapshot.models["deepseek-v4-flash"].totalTokens, 170);
  assert.equal(snapshot.models["deepseek-v4-pro"].totalTokens, 255);
});

test("summarizeDeepSeekSessions aggregates usage by Asia/Shanghai calendar day", () => {
  const snapshot = summarizeDeepSeekSessions({
    generatedAt: "2026-08-21T12:00:00.000Z",
    timeZone: "Asia/Shanghai",
    sessions: [
      {
        sessionId: "session-boundary",
        events: [
          context("deepseek-v4-pro", "2026-08-20T15:59:00.000Z"),
          usageChunk({ turn: 1, step: 1, time: "2026-08-20T15:59:59.000Z", inputTokens: 10, outputTokens: 1 }),
          usageChunk({ turn: 1, step: 2, time: "2026-08-20T16:00:00.000Z", inputTokens: 20, outputTokens: 2 })
        ]
      }
    ]
  });

  assert.deepEqual(snapshot.daily.map((day) => [day.date, day.totalTokens]), [
    ["2026-08-20", 11],
    ["2026-08-21", 22]
  ]);
  assert.equal(snapshot.periods.today.totalTokens, 22);
  assert.equal(snapshot.periods.last7Days.totalTokens, 33);
});

test("summarizeDeepSeekSessions counts reused turn and step coordinates after a later sample", () => {
  const snapshot = summarizeDeepSeekSessions({
    generatedAt: "2026-08-21T12:00:00.000Z",
    sessions: [
      {
        sessionId: "session-restarted-turns",
        events: [
          context("deepseek-v4-pro", "2026-08-21T01:00:00.000Z"),
          usageChunk({ turn: 1, step: 1, time: "2026-08-21T01:01:00.000Z", inputTokens: 10, outputTokens: 1 }),
          assistantMessage({ turn: 1, step: 1, time: "2026-08-21T01:01:01.000Z", inputTokens: 10, outputTokens: 2 }),
          usageChunk({ turn: 1, step: 2, time: "2026-08-21T01:02:00.000Z", inputTokens: 20, outputTokens: 2 }),
          usageChunk({ turn: 1, step: 1, time: "2026-08-21T01:03:00.000Z", inputTokens: 30, outputTokens: 3 })
        ]
      }
    ]
  });

  assert.equal(snapshot.usageSamples, 3);
  assert.equal(snapshot.totals.totalTokens, 67);
});

function context(model, time) {
  return {
    type: "request/context",
    time: Date.parse(time),
    data: { provider: "deepseek-official", model }
  };
}

function usageChunk({ turn, step, time, ...usage }) {
  return {
    type: "assistant/chunk",
    time: Date.parse(time),
    data: { turn, step, chunk: { type: "usage", usage } }
  };
}

function assistantMessage({ turn, step, time, ...usage }) {
  return {
    type: "assistant/message",
    time: Date.parse(time),
    data: { turn, step, usage }
  };
}

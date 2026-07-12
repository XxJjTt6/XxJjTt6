import test from "node:test";
import assert from "node:assert/strict";

import { renderTokscaleHeatmap, summarizeTokscaleGraph } from "../scripts/lib/tokscale-profile.mjs";

test("summarizeTokscaleGraph builds periods and provider totals from graph JSON", () => {
  const summary = summarizeTokscaleGraph({
    meta: {
      generatedAt: "2026-07-13T00:00:00Z",
      version: "4.5.0",
      dateRange: { start: "2026-07-07", end: "2026-07-13" }
    },
    summary: {
      totalTokens: 600,
      totalCost: 6,
      totalDays: 3,
      activeDays: 3
    },
    contributions: [
      {
        date: "2026-07-07",
        totals: { tokens: 100, cost: 1, messages: 1 },
        intensity: 1,
        tokenBreakdown: { input: 10, output: 20, cacheRead: 70, cacheWrite: 0, reasoning: 0 },
        clients: [
          {
            client: "codex",
            modelId: "gpt-test",
            tokens: { input: 10, output: 20, cacheRead: 70, cacheWrite: 0, reasoning: 0 },
            cost: 1,
            messages: 1
          }
        ]
      },
      {
        date: "2026-07-12",
        totals: { tokens: 200, cost: 2, messages: 2 },
        intensity: 2,
        tokenBreakdown: { input: 20, output: 30, cacheRead: 150, cacheWrite: 0, reasoning: 0 },
        clients: [
          {
            client: "claude",
            modelId: "claude-test",
            tokens: { input: 20, output: 30, cacheRead: 150, cacheWrite: 0, reasoning: 0 },
            cost: 2,
            messages: 2
          }
        ]
      },
      {
        date: "2026-07-13",
        totals: { tokens: 300, cost: 3, messages: 3 },
        intensity: 3,
        tokenBreakdown: { input: 30, output: 40, cacheRead: 230, cacheWrite: 0, reasoning: 0 },
        clients: [
          {
            client: "claude",
            modelId: "claude-test",
            tokens: { input: 30, output: 40, cacheRead: 230, cacheWrite: 0, reasoning: 0 },
            cost: 3,
            messages: 3
          }
        ]
      }
    ]
  });

  assert.equal(summary.totals.totalTokens, 600);
  assert.equal(summary.periods.today.totalTokens, 300);
  assert.equal(summary.periods.last7Days.totalCost, 6);
  assert.equal(summary.providers.Codex.totalTokens, 100);
  assert.equal(summary.providers["Claude Code"].messages, 5);
  assert.equal(summary.models["claude-test"].totalTokens, 500);
});

test("renderTokscaleHeatmap leaves vertical room for all rows and the legend", () => {
  const summary = summarizeTokscaleGraph({
    meta: {
      generatedAt: "2026-07-13T00:00:00Z",
      version: "4.5.0",
      dateRange: { start: "2026-07-07", end: "2026-07-13" }
    },
    summary: {
      totalTokens: 100,
      totalCost: 1,
      totalDays: 1,
      activeDays: 1
    },
    contributions: [
      {
        date: "2026-07-13",
        totals: { tokens: 100, cost: 1, messages: 1 },
        intensity: 4,
        tokenBreakdown: { input: 10, output: 20, cacheRead: 70, cacheWrite: 0, reasoning: 0 },
        clients: []
      }
    ]
  });

  const svg = renderTokscaleHeatmap(summary);
  const height = Number(svg.match(/<svg width="\d+" height="(\d+)"/)?.[1]);
  const legendY = Number(svg.match(/<text x="\d+" y="(\d+)" class="muted">Less<\/text>/)?.[1]);

  assert.equal(height >= 226, true);
  assert.equal(legendY >= 208, true);
});

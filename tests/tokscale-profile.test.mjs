import test from "node:test";
import assert from "node:assert/strict";

import { renderTokscaleCard, renderTokscaleHeatmap, renderTokscaleReadme, summarizeTokscaleGraph } from "../scripts/lib/tokscale-profile.mjs";

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

test("summarizeTokscaleGraph uses nested public Tokscale model totals when modelId is empty", () => {
  const summary = summarizeTokscaleGraph({
    meta: {
      generatedAt: "2026-07-13T00:00:00Z",
      version: "4.5.0",
      dateRange: { start: "2026-07-13", end: "2026-07-13" }
    },
    summary: {
      totalTokens: 300,
      totalCost: 3,
      totalDays: 1,
      activeDays: 1
    },
    contributions: [
      {
        date: "2026-07-13",
        totals: { tokens: 300, cost: 3, messages: 2 },
        clients: [
          {
            client: "codex",
            modelId: "",
            models: {
              "gpt-test": { tokens: 100, cost: 1, messages: 1, input: 10, output: 20, cacheRead: 70, cacheWrite: 0, reasoning: 0 },
              "gpt-next": { tokens: 200, cost: 2, messages: 1, input: 20, output: 30, cacheRead: 150, cacheWrite: 0, reasoning: 0 }
            },
            tokens: { input: 30, output: 50, cacheRead: 220, cacheWrite: 0, reasoning: 0 },
            cost: 3,
            messages: 2
          }
        ]
      }
    ]
  });

  assert.equal(summary.models["gpt-test"].totalTokens, 100);
  assert.equal(summary.models["gpt-next"].totalCost, 2);
  assert.equal(summary.models[""], undefined);
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

test("renderTokscaleCard keeps metric values inside the inner card border", () => {
  const svg = renderTokscaleCard({
    profileName: "XxJjTt6",
    handle: "@XxJjTt6",
    rankText: "#453",
    summary: {
      asOfDate: "2026-07-13",
      totals: {
        totalTokens: 13_100_000_000,
        totalCost: 12_300
      }
    }
  });

  const card = svg.match(/<rect x="112" y="(?<y>\d+)" width="696" height="(?<height>\d+)"/)?.groups;
  assert.ok(card, "inner card rectangle should be present");
  const cardBottom = Number(card.y) + Number(card.height);

  const metricBaselines = [...svg.matchAll(/<text x="\d+" y="(?<y>\d+)" class="(?:blue|green|dark)">/g)].map((match) => Number(match.groups.y));
  assert.equal(metricBaselines.length, 3);
  assert.ok(metricBaselines.every((y) => y <= cardBottom - 18), "metric text baselines need bottom padding inside the card");

  const separatorBottoms = [...svg.matchAll(/<line x1="\d+" y1="\d+" x2="\d+" y2="(?<y2>\d+)" stroke="#d8dee4"\/>/g)].map((match) => Number(match.groups.y2));
  assert.ok(separatorBottoms.every((y) => y <= cardBottom), "metric dividers should not cross the inner card border");
});

test("renderTokscaleReadme uses official live Tokscale 2D and 3D graph embeds with profile links", () => {
  const bucket = { totalTokens: 0, totalCost: 0 };
  const readme = renderTokscaleReadme({
    profileName: "XxJjTt6",
    handle: "@XxJjTt6",
    summary: {
      asOfDate: "2026-07-12",
      tokscaleVersion: "4.5.0",
      totals: { totalTokens: 13_000_000_000, totalCost: 12_174.85 },
      periods: {
        today: bucket,
        thisWeek: bucket,
        thisMonth: bucket,
        last7Days: bucket,
        last30Days: bucket
      },
      providers: {},
      models: {}
    }
  });

  assert.match(readme, /https:\/\/tokscale\.ai\/api\/embed\/XxJjTt6\/svg\?theme=light&graph=1&color=blue/);
  assert.match(readme, /https:\/\/tokscale\.ai\/api\/embed\/XxJjTt6\/svg\?theme=light&view=3d&compact=1&color=blue/);
  assert.match(readme, /Open live interactive 2D \/ 3D heatmap/);
  assert.doesNotMatch(readme, /href="[^"]*\/svg/);
  assert.doesNotMatch(readme, /https:\/\/shieldcn\.dev\/tokscale\//);
  assert.doesNotMatch(readme, /tokscale-ai-usage-card\.svg/);
  assert.doesNotMatch(readme, /tokscale-ai-token-heatmap\.svg/);
});

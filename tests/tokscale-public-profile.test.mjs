import test from "node:test";
import assert from "node:assert/strict";

import {
  extractTokscaleProfilePayload,
  tokscalePayloadToGraph
} from "../scripts/lib/tokscale-public-profile.mjs";

function rscScript(recordId, value) {
  return `<script>self.__next_f.push([1,${JSON.stringify(`${recordId}:${JSON.stringify(value)}\n`)}])</script>`;
}

test("extractTokscaleProfilePayload reads the public Tokscale initial data from RSC HTML", () => {
  const payload = [
    "$",
    "$L13",
    null,
    {
      initialData: {
        user: {
          username: "XxJjTt6",
          displayName: "Saber",
          rank: 453
        },
        stats: {
          totalTokens: 13000000000,
          totalCost: 12174.85,
          activeDays: 124,
          submissionCount: 3
        },
        dateRange: {
          start: "2026-01-07",
          end: "2026-07-12"
        },
        updatedAt: "2026-07-12T19:14:17.017Z",
        submissionFreshness: {
          cliVersion: "4.5.0"
        },
        contributions: [
          {
            date: "2026-07-12",
            totals: { tokens: 810180127, cost: 585.7681, messages: 0 },
            intensity: 3,
            tokenBreakdown: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, reasoning: 5 },
            clients: []
          }
        ]
      },
      initialDevices: [
        {
          totalTokens: 13000000000
        }
      ],
      username: "XxJjTt6"
    }
  ];

  const html = `<html><body>${rscScript("9", payload)}</body></html>`;
  const parsed = extractTokscaleProfilePayload(html);

  assert.equal(parsed.username, "XxJjTt6");
  assert.equal(parsed.initialData.user.rank, 453);
  assert.equal(parsed.initialData.contributions.length, 1);
});

test("tokscalePayloadToGraph converts public Tokscale data into the local graph format", () => {
  const graph = tokscalePayloadToGraph({
    username: "XxJjTt6",
    initialData: {
      user: {
        username: "XxJjTt6",
        displayName: "Saber",
        rank: 453
      },
      stats: {
        totalTokens: 13000000000,
        totalCost: 12174.85,
        activeDays: 124,
        submissionCount: 3
      },
      dateRange: {
        start: "2026-01-07",
        end: "2026-07-12"
      },
      updatedAt: "2026-07-12T19:14:17.017Z",
      submissionFreshness: {
        cliVersion: "4.5.0"
      },
      contributions: [
        {
          date: "2026-07-12",
          totals: { tokens: 810180127, cost: 585.7681, messages: 0 },
          intensity: 3,
          tokenBreakdown: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, reasoning: 5 },
          clients: []
        }
      ]
    }
  });

  assert.equal(graph.meta.dateRange.end, "2026-07-12");
  assert.equal(graph.meta.version, "4.5.0");
  assert.equal(graph.profile.rankText, "#453");
  assert.equal(graph.summary.totalTokens, 13000000000);
  assert.equal(graph.contributions[0].date, "2026-07-12");
});

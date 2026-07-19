import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildHourlySyncSnapshot } from "../scripts/lib/tokscale-hourly-sync-v2.mjs";

test("buildHourlySyncSnapshot creates a changing hourly token snapshot", () => {
  const snapshot = buildHourlySyncSnapshot({
    now: new Date("2026-07-19T13:14:15.000Z"),
    graph: {
      summary: {
        totalTokens: 15_200_000_000,
        totalCost: 14_500,
        activeDays: 131
      },
      contributions: [
        { date: "2026-07-18", totals: { tokens: 100, cost: 1 } },
        { date: "2026-07-19", totals: { tokens: 250, cost: 2 } }
      ]
    }
  });

  assert.deepEqual(snapshot, {
    schemaVersion: "tokscale-hourly-sync-v2",
    syncedAt: "2026-07-19T13:14:15.000Z",
    syncHourUtc: "2026-07-19T13:00:00.000Z",
    totalTokens: 15_200_000_000,
    totalCost: 14_500,
    activeDays: 131,
    latestDate: "2026-07-19",
    latestTokens: 250,
    latestCost: 2
  });
});

test("hourly token sync workflow refreshes public data and commits every hour as the profile owner", () => {
  const workflow = readFileSync(new URL("../.github/workflows/hourly-token-sync-v2.yml", import.meta.url), "utf8");

  assert.match(workflow, /name: Hourly token sync/);
  assert.match(workflow, /cron: "13 \* \* \* \*"/);
  assert.match(workflow, /npm run refresh:public/);
  assert.match(workflow, /npm run sync:hourly/);
  assert.match(workflow, /git config user\.name "Xu jiangtao"/);
  assert.match(workflow, /git config user\.email "77684124\+XxJjTt6@users\.noreply\.github\.com"/);
  assert.match(workflow, /data\/tokscale-hourly-sync\.json/);
  assert.doesNotMatch(workflow, /No Tokscale profile changes to commit/);
});

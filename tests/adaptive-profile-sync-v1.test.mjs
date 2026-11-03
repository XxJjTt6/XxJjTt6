import test from "node:test";
import assert from "node:assert/strict";
import { dailyTarget, decideAdaptiveSync } from "../scripts/lib/adaptive-profile-sync-v1.mjs";

const graph = (tokens) => ({ contributions: [{ date: "2026-11-03", totals: { tokens } }] });

test("daily target responds to prior-day measured usage within 21–40", () => {
  const amounts = [0, 15_000_000, 60_000_000, 1_000_000_000_000];
  const targets = amounts.map((tokens) => dailyTarget(graph(tokens), "2026-11-04"));
  assert.ok(targets.every((target) => target >= 21 && target <= 40));
  assert.ok(targets.every((target, index) => index === 0 || target > targets[index - 1]));
  const staleDays = Array.from({ length: 7 }, (_, index) => dailyTarget({ contributions: [] }, `2026-11-${String(index + 4).padStart(2, "0")}`));
  assert.ok(new Set(staleDays).size > 1);
});

test("48 checks distribute the selected number of commits without a fixed hourly count", () => {
  for (const tokens of [0, 15_000_000, 60_000_000, 1_000_000_000_000]) {
    const commits = [];
    for (let slot = 0; slot < 48; slot += 1) {
      const now = new Date(Date.UTC(2026, 10, 3, 16) + slot * 30 * 60_000 + 13 * 60_000);
      const decision = decideAdaptiveSync({ now, graph: graph(tokens), commitDates: commits });
      if (decision.shouldCommit) commits.push(now.toISOString());
    }
    assert.equal(commits.length, dailyTarget(graph(tokens), "2026-11-04"));
  }
});

test("other owner commits consume the budget and the Shanghai day resets at 00:00", () => {
  const previous = Array.from({ length: 40 }, () => "2026-11-03T15:59:00.000Z");
  const now = new Date("2026-11-04T15:43:00.000Z");
  const commits = Array.from({ length: 40 }, () => "2026-11-04T00:00:00.000Z");
  assert.equal(decideAdaptiveSync({ now, graph: graph(15_000_000), commitDates: [...previous, ...commits] }).shouldCommit, false);
  assert.equal(decideAdaptiveSync({ now: new Date("2026-11-03T16:43:00.000Z"), graph: graph(15_000_000), commitDates: previous }).existing, 0);
});

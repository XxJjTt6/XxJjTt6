import { spawnSync } from "node:child_process";

const TIME_ZONE = "Asia/Shanghai";
const HALF_HOURS_PER_DAY = 48;

export function shanghaiParts(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`,
    slot: Number(parts.hour) * 2 + Math.floor(Number(parts.minute) / 30) };
}

export function yesterday(date) {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function dailyTarget(graph, date) {
  const tokens = Math.max(0, Number(graph?.contributions?.find((day) => day.date === yesterday(date))?.totals?.tokens) || 0);
  // Usage changes the budget; a small stable daily spread prevents stale Tokscale data
  // from turning the schedule back into an identical count every day.
  let hash = 2166136261;
  for (const char of date) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const spread = hash % 9;
  return Math.min(40, 21 + Math.round(14 * tokens / (tokens + 15_000_000)) + spread);
}

export function decideAdaptiveSync({ now = new Date(), graph, commitDates = [] }) {
  const { date, slot } = shanghaiParts(now);
  const target = dailyTarget(graph, date);
  const existing = commitDates.filter((value) => shanghaiParts(new Date(value)).date === date).length;
  const dueByNow = Math.floor((slot + 1) * target / HALF_HOURS_PER_DAY);
  return { date, slot, target, existing, dueByNow, shouldCommit: existing < target && existing < dueByNow };
}

export function readOwnerCommitDates(repo) {
  const result = spawnSync("git", ["log", "-n", "500", "--format=%aI%x09%ae", "origin/main"],
    { cwd: repo, encoding: "utf8", timeout: 30_000 });
  if (result.status !== 0 || result.error) throw new Error("Could not count current profile commits");
  return result.stdout.trim().split("\n").map((line) => line.split("\t"))
    .filter(([, email]) => email && !/github-actions\[bot\]/i.test(email))
    .map(([date]) => date);
}

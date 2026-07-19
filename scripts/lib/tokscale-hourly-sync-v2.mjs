export function buildHourlySyncSnapshot({ now = new Date(), graph }) {
  if (!graph || typeof graph !== "object") {
    throw new TypeError("Tokscale graph JSON is required");
  }

  const contributions = Array.isArray(graph.contributions) ? graph.contributions : [];
  const latestContribution = contributions
    .filter((contribution) => contribution?.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1);

  const syncHour = new Date(now);
  syncHour.setUTCMinutes(0, 0, 0);

  return {
    schemaVersion: "tokscale-hourly-sync-v2",
    syncedAt: now.toISOString(),
    syncHourUtc: syncHour.toISOString(),
    totalTokens: graph.summary?.totalTokens ?? 0,
    totalCost: graph.summary?.totalCost ?? 0,
    activeDays: graph.summary?.activeDays ?? 0,
    latestDate: latestContribution?.date ?? null,
    latestTokens: latestContribution?.totals?.tokens ?? 0,
    latestCost: latestContribution?.totals?.cost ?? 0
  };
}

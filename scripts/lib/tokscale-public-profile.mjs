export const TOKSCALE_PROFILE_BASE_URL = "https://tokscale.ai/u";

export function extractTokscaleProfilePayload(html) {
  const chunks = decodeNextFlightChunks(html);
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      if (!line.includes("initialData")) {
        continue;
      }

      const payload = parseFlightRecordPayload(line);
      const found = findProfilePayload(payload);
      if (found) {
        return found;
      }
    }
  }

  throw new Error("Could not find public Tokscale profile data in the page HTML.");
}

export function tokscalePayloadToGraph(payload) {
  const data = payload.initialData;
  if (!data?.dateRange?.end || !Array.isArray(data.contributions)) {
    throw new Error("Tokscale public profile payload is missing date range or contributions.");
  }

  return {
    meta: {
      generatedAt: data.updatedAt ?? new Date().toISOString(),
      version: data.submissionFreshness?.cliVersion ?? null,
      source: `${TOKSCALE_PROFILE_BASE_URL}/${encodeURIComponent(payload.username ?? data.user?.username ?? "")}`,
      dateRange: {
        start: data.dateRange.start ?? data.contributions[0]?.date ?? data.dateRange.end,
        end: data.dateRange.end
      }
    },
    profile: {
      username: payload.username ?? data.user?.username ?? null,
      displayName: data.user?.displayName ?? null,
      rank: data.user?.rank ?? null,
      rankText: formatRank(data.user?.rank),
      updatedAt: data.updatedAt ?? null,
      submissionCount: data.stats?.submissionCount ?? null
    },
    summary: {
      totalTokens: data.stats?.totalTokens ?? sumContributionField(data.contributions, "tokens"),
      totalCost: data.stats?.totalCost ?? sumContributionField(data.contributions, "cost"),
      totalDays: data.contributions.length,
      activeDays: data.stats?.activeDays ?? data.contributions.filter((day) => (day.totals?.tokens ?? 0) > 0).length
    },
    contributions: data.contributions
  };
}

export async function fetchTokscalePublicGraph({ username, fetchImpl = globalThis.fetch } = {}) {
  if (!username) {
    throw new Error("A Tokscale username is required.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation is available.");
  }

  const url = `${TOKSCALE_PROFILE_BASE_URL}/${encodeURIComponent(username)}`;
  const response = await fetchImpl(url, {
    headers: {
      "user-agent": "XxJjTt6-profile-readme-refresh/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Tokscale profile request failed with HTTP ${response.status}.`);
  }

  const html = await response.text();
  return tokscalePayloadToGraph(extractTokscaleProfilePayload(html));
}

function decodeNextFlightChunks(html) {
  const chunks = [];
  const pattern = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  for (const match of html.matchAll(pattern)) {
    chunks.push(JSON.parse(`"${match[1]}"`));
  }
  return chunks;
}

function parseFlightRecordPayload(line) {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }
  return JSON.parse(line.slice(separatorIndex + 1));
}

function findProfilePayload(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (value.initialData?.user && Array.isArray(value.initialData?.contributions)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProfilePayload(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findProfilePayload(item);
    if (found) {
      return found;
    }
  }
  return null;
}

function formatRank(rank) {
  return Number.isFinite(rank) ? `#${rank}` : "Unranked";
}

function sumContributionField(contributions, field) {
  return contributions.reduce((total, day) => total + (day.totals?.[field] ?? 0), 0);
}

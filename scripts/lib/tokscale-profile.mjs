import { addDays, previousSunday, weekStartMonday } from "./date.mjs";

const HEATMAP_COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function summarizeTokscaleGraph(graph) {
  const contributions = [...(graph.contributions ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const asOfDate = graph.meta?.dateRange?.end ?? contributions.at(-1)?.date;
  const firstActivityDate = graph.meta?.dateRange?.start ?? contributions[0]?.date ?? asOfDate;
  if (!asOfDate) {
    throw new Error("Tokscale graph has no date range or contributions.");
  }

  const daily = contributions.map((day) => normalizeContribution(day));
  const totals = sumDays(daily, firstActivityDate, asOfDate);
  totals.totalCost = graph.summary?.totalCost ?? totals.totalCost;
  totals.totalTokens = graph.summary?.totalTokens ?? totals.totalTokens;

  const providers = {};
  const models = {};
  for (const day of daily) {
    for (const client of day.clients) {
      const provider = labelClient(client.client);
      providers[provider] ??= emptyBucket();
      mergeClient(providers[provider], client);

      const modelEntries = Object.entries(client.models ?? {});
      if (modelEntries.length > 0) {
        for (const [model, stats] of modelEntries) {
          models[model] ??= emptyBucket();
          mergeModelStats(models[model], stats);
        }
      } else {
        const model = client.modelId || "unknown";
        models[model] ??= emptyBucket();
        mergeClient(models[model], client);
      }
    }
  }

  const thisWeekStart = weekStartMonday(asOfDate);
  const thisMonthStart = `${asOfDate.slice(0, 7)}-01`;
  return {
    generatedAt: graph.meta?.generatedAt ?? new Date().toISOString(),
    tokscaleVersion: graph.meta?.version ?? null,
    asOfDate,
    firstActivityDate,
    totalDays: graph.summary?.totalDays ?? daily.length,
    activeDays: graph.summary?.activeDays ?? daily.filter((day) => day.totalTokens > 0).length,
    totals,
    periods: {
      today: sumDays(daily, asOfDate, asOfDate),
      thisWeek: sumDays(daily, thisWeekStart, asOfDate),
      thisMonth: sumDays(daily, thisMonthStart, asOfDate),
      last7Days: sumDays(daily, addDays(asOfDate, -6), asOfDate),
      last30Days: sumDays(daily, addDays(asOfDate, -29), asOfDate),
      lastYear: sumDays(daily, addDays(asOfDate, -364), asOfDate)
    },
    providers,
    models,
    daily
  };
}

export function renderTokscaleReadme({ summary, profileName, handle }) {
  const username = handle.replace(/^@/, "");
  const profileUrl = `https://tokscale.ai/u/${encodeURIComponent(username)}`;
  const heatmap2dUrl = `https://tokscale.ai/api/embed/${encodeURIComponent(username)}/svg?theme=light&graph=1&color=blue&tokens=compact&cost=compact`;
  const heatmap3dUrl = `https://tokscale.ai/api/embed/${encodeURIComponent(username)}/svg?theme=light&view=3d&compact=1&color=blue`;
  const providerRows = Object.entries(summary.providers)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
    .map(([provider, stats]) => `| ${provider} | ${formatInteger(stats.totalTokens)} | ${formatMoney(stats.totalCost)} | ${formatInteger(stats.messages)} |`)
    .join("\n");
  const modelRows = Object.entries(summary.models)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
    .slice(0, 8)
    .map(([model, stats]) => `| ${model} | ${formatInteger(stats.totalTokens)} | ${formatMoney(stats.totalCost)} | ${formatInteger(stats.messages)} |`)
    .join("\n");

  return `<!--
Generated from Tokscale public profile data.
The visible Tokscale graphs are official live Tokscale embeds.
Click targets open the Tokscale public profile, not image files.
-->

<div align="center">

# ${profileName}

**AI-native builder | local agents | automation loops**

<p>
  <a href="${profileUrl}">
    <img src="${heatmap2dUrl}" alt="${profileName} live Tokscale 2D usage graph" width="680">
  </a>
</p>

<p>
  <a href="${profileUrl}">
    <img src="${heatmap3dUrl}" alt="${profileName} live Tokscale 3D usage graph" width="680">
  </a>
</p>

<p><a href="${profileUrl}">Open live daily token hover details on Tokscale</a></p>

</div>

## AI Usage

| Window | Tokens | Cost |
| --- | ---: | ---: |
| Today | ${formatInteger(summary.periods.today.totalTokens)} | ${formatMoney(summary.periods.today.totalCost)} |
| This week | ${formatInteger(summary.periods.thisWeek.totalTokens)} | ${formatMoney(summary.periods.thisWeek.totalCost)} |
| This month | ${formatInteger(summary.periods.thisMonth.totalTokens)} | ${formatMoney(summary.periods.thisMonth.totalCost)} |
| Last 7 days | ${formatInteger(summary.periods.last7Days.totalTokens)} | ${formatMoney(summary.periods.last7Days.totalCost)} |
| Last 30 days | ${formatInteger(summary.periods.last30Days.totalTokens)} | ${formatMoney(summary.periods.last30Days.totalCost)} |
| All time | ${formatInteger(summary.totals.totalTokens)} | ${formatMoney(summary.totals.totalCost)} |

## Sources

| Source | Tokens | Cost | Messages |
| --- | ---: | ---: | ---: |
${providerRows || "| No usage found | 0 | $0.00 | 0 |"}

## Models

| Model | Tokens | Cost | Messages |
| --- | ---: | ---: | ---: |
${modelRows || "| No usage found | 0 | $0.00 | 0 |"}

<sub>Updated ${summary.asOfDate}. Public aggregate data from Tokscale ${summary.tokscaleVersion ?? ""}; live graphs served by Tokscale.</sub>
`;
}

export function renderTokscaleCard({ summary, profileName, handle, rankText = "Submit for rank" }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="920" height="360" viewBox="0 0 920 360" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(profileName)} Tokscale AI Usage</title>
  <desc id="desc">Tokscale-style local AI token usage card.</desc>
  <style>
    .bg { fill: #ffffff; }
    .muted { fill: #57606a; font: 600 18px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .tiny { fill: #57606a; font: 600 15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .title { fill: #24292f; font: 800 34px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .name { fill: #24292f; font: 800 28px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .handle { fill: #57606a; font: 600 20px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .label { fill: #57606a; font: 700 17px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .blue { fill: #0969da; font: 800 40px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .green { fill: #1a7f37; font: 800 40px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .dark { fill: #24292f; font: 800 32px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  </style>
  <rect class="bg" x="0.5" y="0.5" width="919" height="359" rx="10" stroke="#d0d7de"/>
  <text x="34" y="48" class="muted">${escapeXml(profileName)} / README.md</text>
  <text x="460" y="96" text-anchor="middle" class="title">AI Usage</text>
  <line x1="34" y1="118" x2="886" y2="118" stroke="#d8dee4"/>
  <rect x="112" y="148" width="696" height="176" rx="12" fill="#ffffff" stroke="#d0d7de" stroke-width="1.5"/>
  <text x="142" y="188" class="name">${escapeXml(profileName)}</text>
  <text x="142" y="215" class="handle">${escapeXml(handle)}</text>
  <text x="732" y="188" text-anchor="end" class="muted">Tokscale</text>
  <line x1="142" y1="236" x2="778" y2="236" stroke="#d8dee4"/>
  <text x="142" y="265" class="label">Tokens</text>
  <text x="142" y="303" class="blue">${formatCompact(summary.totals.totalTokens)}</text>
  <line x1="306" y1="248" x2="306" y2="309" stroke="#d8dee4"/>
  <text x="334" y="265" class="label">Cost</text>
  <text x="334" y="303" class="green">${formatMoneyCompact(summary.totals.totalCost)}</text>
  <line x1="514" y1="248" x2="514" y2="309" stroke="#d8dee4"/>
  <text x="542" y="265" class="label">Rank (Tokens)</text>
  <text x="542" y="301" class="dark">${escapeXml(rankText)}</text>
  <text x="112" y="345" class="tiny">Updated ${formatDisplayDate(summary.asOfDate)}</text>
  <text x="808" y="345" text-anchor="end" class="tiny">tokscale.ai</text>
</svg>
`;
}

export function renderTokscaleHeatmap(summary) {
  const cell = 11;
  const gap = 3;
  const cols = 53;
  const labelWidth = 58;
  const top = 54;
  const gridX = labelWidth + 8;
  const gridY = top + 28;
  const width = gridX + cols * (cell + gap) + 120;
  const gridBottom = gridY + 7 * (cell + gap);
  const legendY = gridBottom + 18;
  const height = legendY + 30;
  const start = previousSunday(addDays(summary.asOfDate, -364));
  const values = new Map(summary.daily.map((day) => [day.date, day]));
  const monthLabels = [];
  const cells = [];
  let activeMonth = "";

  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const date = addDays(start, col * 7 + row);
      if (date > summary.asOfDate) {
        continue;
      }
      const month = date.slice(5, 7);
      if (month !== activeMonth) {
        activeMonth = month;
        monthLabels.push({ month: monthName(date), x: gridX + col * (cell + gap) });
      }
      const day = values.get(date);
      const tokens = day?.totalTokens ?? 0;
      const intensity = Math.max(0, Math.min(4, day?.intensity ?? 0));
      const x = gridX + col * (cell + gap);
      const y = gridY + row * (cell + gap);
      cells.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${HEATMAP_COLORS[intensity]}"><title>${date}: ${formatInteger(tokens)} tokens</title></rect>`);
    }
  }

  const legendX = width - 218;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Tokscale AI token heatmap</title>
  <desc id="desc">Daily Tokscale token usage in a GitHub-style heatmap.</desc>
  <style>
    .title { fill: #24292f; font: 500 20px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .axis { fill: #24292f; font: 400 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .muted { fill: #57606a; font: 400 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#ffffff" stroke="#d0d7de"/>
  <text x="${labelWidth}" y="34" class="title">${formatInteger(summary.periods.lastYear.totalTokens)} AI tokens in the last year</text>
  ${monthLabels.map((item) => `<text x="${item.x}" y="${top}" class="axis">${item.month}</text>`).join("\n  ")}
  <text x="28" y="${gridY + 2 * (cell + gap) + 10}" class="axis">Mon</text>
  <text x="28" y="${gridY + 4 * (cell + gap) + 10}" class="axis">Wed</text>
  <text x="33" y="${gridY + 6 * (cell + gap) + 10}" class="axis">Fri</text>
  ${cells.join("\n  ")}
  <text x="${legendX}" y="${legendY + 10}" class="muted">Less</text>
  ${HEATMAP_COLORS.map((color, index) => `<rect x="${legendX + 38 + index * 17}" y="${legendY}" width="11" height="11" rx="2" fill="${color}"/>`).join("\n  ")}
  <text x="${legendX + 132}" y="${legendY + 10}" class="muted">More</text>
</svg>
`;
}

function normalizeContribution(day) {
  const tokenBreakdown = day.tokenBreakdown ?? {};
  return {
    date: day.date,
    intensity: day.intensity ?? 0,
    totalTokens: day.totals?.tokens ?? sumTokenObject(tokenBreakdown),
    totalCost: day.totals?.cost ?? 0,
    messages: day.totals?.messages ?? 0,
    inputTokens: tokenBreakdown.input ?? 0,
    outputTokens: tokenBreakdown.output ?? 0,
    cacheReadTokens: tokenBreakdown.cacheRead ?? 0,
    cacheWriteTokens: tokenBreakdown.cacheWrite ?? 0,
    reasoningTokens: tokenBreakdown.reasoning ?? 0,
    activeTimeMs: day.activeTimeMs ?? 0,
    clients: day.clients ?? []
  };
}

function emptyBucket() {
  return {
    totalTokens: 0,
    totalCost: 0,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0
  };
}

function sumDays(days, startDate, endDate) {
  const bucket = emptyBucket();
  for (const day of days) {
    if (day.date >= startDate && day.date <= endDate) {
      mergeDay(bucket, day);
    }
  }
  return bucket;
}

function mergeDay(target, day) {
  target.totalTokens += day.totalTokens;
  target.totalCost += day.totalCost;
  target.messages += day.messages;
  target.inputTokens += day.inputTokens;
  target.outputTokens += day.outputTokens;
  target.cacheReadTokens += day.cacheReadTokens;
  target.cacheWriteTokens += day.cacheWriteTokens;
  target.reasoningTokens += day.reasoningTokens;
}

function mergeClient(target, client) {
  const tokens = client.tokens ?? {};
  target.inputTokens += tokens.input ?? 0;
  target.outputTokens += tokens.output ?? 0;
  target.cacheReadTokens += tokens.cacheRead ?? 0;
  target.cacheWriteTokens += tokens.cacheWrite ?? 0;
  target.reasoningTokens += tokens.reasoning ?? 0;
  target.totalTokens += sumTokenObject(tokens);
  target.totalCost += client.cost ?? 0;
  target.messages += client.messages ?? 0;
}

function mergeModelStats(target, stats) {
  target.inputTokens += stats.input ?? 0;
  target.outputTokens += stats.output ?? 0;
  target.cacheReadTokens += stats.cacheRead ?? 0;
  target.cacheWriteTokens += stats.cacheWrite ?? 0;
  target.reasoningTokens += stats.reasoning ?? 0;
  target.totalTokens += stats.tokens ?? 0;
  target.totalCost += stats.cost ?? 0;
  target.messages += stats.messages ?? 0;
}

function sumTokenObject(tokens) {
  return (tokens.input ?? 0) + (tokens.output ?? 0) + (tokens.cacheRead ?? 0) + (tokens.cacheWrite ?? 0);
}

function labelClient(client) {
  if (client === "codex") {
    return "Codex";
  }
  if (client === "claude") {
    return "Claude Code";
  }
  return client;
}

function monthName(dateString) {
  return MONTHS[Number(dateString.slice(5, 7)) - 1] ?? dateString.slice(5, 7);
}

function formatDisplayDate(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatCompact(value) {
  const number = Number(value ?? 0);
  const units = [
    { suffix: "T", value: 1e12 },
    { suffix: "B", value: 1e9 },
    { suffix: "M", value: 1e6 },
    { suffix: "K", value: 1e3 }
  ];
  for (const unit of units) {
    if (Math.abs(number) >= unit.value) {
      const scaled = number / unit.value;
      return `${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}${unit.suffix}`;
    }
  }
  return formatInteger(number);
}

function formatMoney(value) {
  return `$${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatMoneyCompact(value) {
  return `$${formatCompact(value)}`;
}

function formatInteger(value) {
  return Math.round(Number(value ?? 0)).toLocaleString("en-US");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

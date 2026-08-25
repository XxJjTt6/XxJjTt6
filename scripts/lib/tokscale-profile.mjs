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

export function renderTokscaleReadme({ summary, profileName, handle, deepseekSummary = null }) {
  const username = handle.replace(/^@/, "");
  const profileUrl = `https://tokscale.ai/u/${encodeURIComponent(username)}`;
  const heatmap2dUrl = `https://tokscale.ai/api/embed/${encodeURIComponent(username)}/svg?theme=light&graph=1&color=blue&tokens=compact&cost=compact`;
  const heatmap3dUrl = `https://tokscale.ai/api/embed/${encodeURIComponent(username)}/svg?theme=light&view=3d&compact=1&color=blue`;
  const combined = combineUsageSummaries(summary, deepseekSummary);
  const providerRows = Object.entries(combined.providers)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
    .map(([provider, stats]) => `| ${provider} | ${formatInteger(stats.totalTokens)} | ${formatOptionalMoney(stats.totalCost)} | ${formatInteger(stats.messages)} |`)
    .join("\n");
  const modelRows = Object.entries(combined.models)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
    .slice(0, 12)
    .map(([model, stats]) => `| ${model} | ${formatInteger(stats.totalTokens)} | ${formatOptionalMoney(stats.totalCost)} | ${formatInteger(stats.messages)} |`)
    .join("\n");
  const deepseekDisclosure = combined.includesDeepSeek
    ? `\n> The live 2D/3D graphs above are official Tokscale embeds and currently cover Codex and Claude Code. The tables below also include provider-reported DeepSeek Desktop usage from the [auditable snapshot](./data/deepseek-desktop-usage.json).`
    : "";
  const costHeader = combined.includesDeepSeek ? "Known cost" : "Cost";
  const costDisclosure = combined.includesDeepSeek
    ? " DeepSeek Desktop logs contain token usage but no billing amount, so known cost excludes DeepSeek Desktop."
    : "";

  return `<!--
The project narrative below is intentionally evidence-first.
Only the AI activity section is generated from Tokscale public profile data.
Tokscale graphs are official live embeds; click targets open the public profile.
DeepSeek Desktop tables use provider-reported local DSH session logs when present.
-->

<div align="center">

# ${profileName}

**LLM / Agent Infra · Evaluation · Multimodal RAG**

把 Agent 从“能跑的 Demo”推进到**可执行、可评测、可审计、可回退**的工程系统。

<p>
  <a href="https://github.com/XxJjTt6/AI-Hackahton_meituan"><strong>AutoSolver · 10/10 合法提交</strong></a>
  ·
  <a href="https://github.com/XxJjTt6/nowogen-knowledge-assistant"><strong>Enterprise RAG · 48 个公开来源</strong></a>
  ·
  <a href="https://github.com/XxJjTt6/feishu-ai-pioneer-competition"><strong>Trend2SKU · 400 条合成样本</strong></a>
</p>

</div>

## 我在做什么

我专注于 LLM / Agent 系统的工程化落地，主线不是堆叠模型名，而是解决三个可验证的问题：

- **运行时是否可靠**：工具调用、状态流、并发、超时、进程隔离与失败回退是否真正闭环；
- **结果是否可信**：答案或决策是否有证据、可复评、可追踪，并明确区分官方数据、合成数据与演示结果；
- **系统是否可交付**：是否提供可运行入口、测试、验收脚本、审计记录和清晰的结果边界。

## 代表项目

### AutoSolver · 受控代码生成与可执行评测

> 美团 AI Hackathon AutoSolver 决赛项目。把 LLM 生成代码放进受约束的候选链路，而不是直接进入正式求解热路径。

- 构建“代码生成 → AST 策略门 → 独立 Worker 试跑 → 父进程复评 → Critic 修正 → best-so-far 晋升 / 回退”闭环；
- 对导入、危险调用、环境变量、网络、墙钟时间和进程组回收设置约束，Worker 分数由父进程按官方目标函数重新计算；
- **官方记录：平均分 706.197（越低越好），10 / 10 个用例全部合法。**

[项目仓库](https://github.com/XxJjTt6/AI-Hackahton_meituan) · [官方提交记录](https://github.com/XxJjTt6/AI-Hackahton_meituan/blob/main/archive/runs/official_submit_20260520_132026_70222083.json) · [测试目录](https://github.com/XxJjTt6/AI-Hackahton_meituan/tree/main/tests)

### 氢擎智服 · 多模态企业知识 Agent

> 面向燃料电池产品问答与初步选型的 RAG 工作台，目标是“答案可用、证据可查、边界可控、过程可审”。

- 组织 9 类协作角色，以 Parent / Child 分块、中文词法、可选稠密向量、RRF 融合与重排构成混合检索链路；
- 在回答前后执行证据覆盖检查与事实核验，对价格、交期、认证和故障根因等高风险事项拒绝无据承诺；
- **交付证据：13 份发布知识文档、48 条公开来源、25 项后端测试通过，并提供统一验收脚本。**

[项目仓库](https://github.com/XxJjTt6/nowogen-knowledge-assistant) · [在线演示](http://47.93.220.66/qingqingrag/) · [项目自检报告](https://github.com/XxJjTt6/nowogen-knowledge-assistant/blob/main/docs/project-audit.md)

[![氢擎智服系统架构](https://raw.githubusercontent.com/XxJjTt6/nowogen-knowledge-assistant/main/docs/architecture/system-overview.png)](https://github.com/XxJjTt6/nowogen-knowledge-assistant)

### Trend2SKU · 可审计产品决策 Agent

> 独立完成的决策原型：结构化输入 → VOC / 趋势 / 竞品证据 → 动态候选 → 八维评分 → HITL → 报告。

- 使用稳定候选 ID 串联概念、评分、模拟访谈和风险，避免多候选并发时发生结果串线；
- 提供 CLI、同步 API、SSE 事件流、人工复核、运行 trace、报告下载与远程模型失败后的离线降级；
- **数据边界明确：400 条评论是固定种子的合成离线演示数据，不包装成真实用户研究或爆款概率。**

[项目仓库](https://github.com/XxJjTt6/feishu-ai-pioneer-competition) · [测试目录](https://github.com/XxJjTt6/feishu-ai-pioneer-competition/tree/main/backend/tests)

## 公开证据标准

- 代表项目均保留源码、提交历史、测试或审计材料；数字主张优先链接到公开记录，而不是只写在个人介绍中；
- 官方评测、离线回归、合成数据和在线演示使用不同口径，不把一种结果替换成另一种结果；
- 更完整的“主张 → 公开证据 → 适用边界”映射见 [PROFILE_EVIDENCE.md](./PROFILE_EVIDENCE.md)。

## 工程能力地图

| 方向 | 可落地能力 | 项目证据 |
| --- | --- | --- |
| Agent Runtime | 状态流、工具注册、SSE、HITL、会话与并发隔离 | [Trend2SKU](https://github.com/XxJjTt6/feishu-ai-pioneer-competition)、[氢擎智服](https://github.com/XxJjTt6/nowogen-knowledge-assistant) |
| Reliability | AST 静态门禁、进程沙箱、超时回收、失败分类、稳定回退 | [AutoSolver](https://github.com/XxJjTt6/AI-Hackahton_meituan) |
| Retrieval | Parent / Child 分块、词法 / 向量混合检索、RRF、重排、型号路由 | [氢擎智服](https://github.com/XxJjTt6/nowogen-knowledge-assistant) |
| Evaluation | 官方目标函数复评、场景回归、证据覆盖、可审计 trace | [AutoSolver](https://github.com/XxJjTt6/AI-Hackahton_meituan)、[氢擎智服](https://github.com/XxJjTt6/nowogen-knowledge-assistant) |

## AI 工程活动

<details>
<summary><strong>展开 Tokscale 动态记录</strong>：这是工具使用强度，不等同于代码质量或项目成果</summary>

<p align="center">
  <a href="${profileUrl}">
    <img src="${heatmap2dUrl}" alt="${profileName} live Tokscale 2D usage graph" width="680">
  </a>
</p>

<p align="center">
  <a href="${profileUrl}">
    <img src="${heatmap3dUrl}" alt="${profileName} live Tokscale 3D usage graph" width="680">
  </a>
</p>

<p align="center"><a href="${profileUrl}">在 Tokscale 查看逐日明细</a></p>
${deepseekDisclosure}

### 使用窗口

| Window | Tokens | ${costHeader} |
| --- | ---: | ---: |
| Today | ${formatInteger(combined.periods.today.totalTokens)} | ${formatMoney(combined.periods.today.totalCost)} |
| This week | ${formatInteger(combined.periods.thisWeek.totalTokens)} | ${formatMoney(combined.periods.thisWeek.totalCost)} |
| This month | ${formatInteger(combined.periods.thisMonth.totalTokens)} | ${formatMoney(combined.periods.thisMonth.totalCost)} |
| Last 7 days | ${formatInteger(combined.periods.last7Days.totalTokens)} | ${formatMoney(combined.periods.last7Days.totalCost)} |
| Last 30 days | ${formatInteger(combined.periods.last30Days.totalTokens)} | ${formatMoney(combined.periods.last30Days.totalCost)} |
| All time | ${formatInteger(combined.totals.totalTokens)} | ${formatMoney(combined.totals.totalCost)} |

### 工具来源

| Source | Tokens | Cost | Messages |
| --- | ---: | ---: | ---: |
${providerRows || "| No usage found | 0 | $0.00 | 0 |"}

### 模型

| Model | Tokens | Cost | Messages |
| --- | ---: | ---: | ---: |
${modelRows || "| No usage found | 0 | $0.00 | 0 |"}

<sub>Updated ${combined.asOfDate}. Codex and Claude Code aggregate data from Tokscale ${summary.tokscaleVersion ?? ""}; live graphs served by Tokscale.${costDisclosure}</sub>

</details>

---

**目标方向：LLM / Agent Infra、AI 平台工程、模型与 Agent 评测。**
`;
}

export function combineUsageSummaries(summary, deepseekSummary = null) {
  const asOfDate = [summary.asOfDate, deepseekSummary?.asOfDate].filter(Boolean).sort().at(-1);
  let periods = Object.fromEntries(
    ["today", "thisWeek", "thisMonth", "last7Days", "last30Days"].map((period) => [
      period,
      combinePeriod(summary.periods[period], deepseekSummary?.periods?.[period])
    ])
  );
  const providers = Object.fromEntries(
    Object.entries(summary.providers).map(([key, value]) => [key, { ...value }])
  );
  const models = Object.fromEntries(
    Object.entries(summary.models).map(([key, value]) => [key, { ...value }])
  );
  const includesDeepSeek = Boolean(deepseekSummary);

  if (includesDeepSeek) {
    providers["DeepSeek Desktop"] = deepSeekBucketForReadme(deepseekSummary.totals);
    for (const [model, stats] of Object.entries(deepseekSummary.models ?? {})) {
      models[model] = deepSeekBucketForReadme(stats);
    }
    if (Array.isArray(summary.daily) && Array.isArray(deepseekSummary.daily)) {
      periods = buildCombinedPeriods(summary.daily, deepseekSummary.daily, asOfDate);
    }
  }

  return {
    includesDeepSeek,
    asOfDate,
    totals: combinePeriod(summary.totals, deepseekSummary?.totals),
    periods,
    providers,
    models
  };
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

function combinePeriod(tokscale = {}, deepseek = {}) {
  return {
    totalTokens: (tokscale.totalTokens ?? 0) + (deepseek.totalTokens ?? 0),
    totalCost: tokscale.totalCost ?? 0,
    messages: (tokscale.messages ?? 0) + (deepseek.requests ?? deepseek.messages ?? 0),
    inputTokens: (tokscale.inputTokens ?? 0) + (deepseek.inputTokens ?? 0),
    outputTokens: (tokscale.outputTokens ?? 0) + (deepseek.outputTokens ?? 0),
    cacheReadTokens: (tokscale.cacheReadTokens ?? 0) + (deepseek.cacheReadTokens ?? 0),
    cacheWriteTokens: (tokscale.cacheWriteTokens ?? 0) + (deepseek.cacheWriteTokens ?? 0),
    reasoningTokens: (tokscale.reasoningTokens ?? 0) + (deepseek.reasoningTokens ?? 0)
  };
}

function deepSeekBucketForReadme(stats = {}) {
  return {
    totalTokens: stats.totalTokens ?? 0,
    totalCost: null,
    messages: stats.requests ?? 0,
    inputTokens: stats.inputTokens ?? 0,
    outputTokens: stats.outputTokens ?? 0,
    cacheReadTokens: stats.cacheReadTokens ?? 0,
    cacheWriteTokens: stats.cacheWriteTokens ?? 0,
    reasoningTokens: stats.reasoningTokens ?? 0
  };
}

function buildCombinedPeriods(tokscaleDaily, deepseekDaily, asOfDate) {
  const daily = new Map();
  for (const day of tokscaleDaily) {
    daily.set(day.date, combinePeriod(day));
  }
  for (const day of deepseekDaily) {
    daily.set(day.date, combinePeriod(daily.get(day.date), day));
  }

  const sumRange = (startDate) => {
    const bucket = combinePeriod();
    for (const [date, day] of daily) {
      if (date >= startDate && date <= asOfDate) {
        mergeCombinedBucket(bucket, day);
      }
    }
    return bucket;
  };

  return {
    today: sumRange(asOfDate),
    thisWeek: sumRange(weekStartMonday(asOfDate)),
    thisMonth: sumRange(`${asOfDate.slice(0, 7)}-01`),
    last7Days: sumRange(addDays(asOfDate, -6)),
    last30Days: sumRange(addDays(asOfDate, -29))
  };
}

function mergeCombinedBucket(target, source) {
  for (const key of [
    "totalTokens",
    "totalCost",
    "messages",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "reasoningTokens"
  ]) {
    target[key] += source[key] ?? 0;
  }
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

function formatOptionalMoney(value) {
  return value === null || value === undefined ? "—" : formatMoney(value);
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

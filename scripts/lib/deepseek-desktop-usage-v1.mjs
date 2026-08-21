import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import { addDays, weekStartMonday } from "./date.mjs";

export const DEEPSEEK_DESKTOP_SCHEMA_VERSION = "deepseek-desktop-usage-v1";
export const DEEPSEEK_DESKTOP_SOURCE = "DeepSeek Desktop";

export async function scanDeepSeekDesktopUsage({
  sessionsRoot,
  generatedAt = new Date(),
  timeZone = "Asia/Shanghai",
  zstdcatPath
} = {}) {
  if (!sessionsRoot) {
    throw new TypeError("A DeepSeek Desktop sessions root is required.");
  }

  const files = await findSessionFiles(sessionsRoot);
  const sessions = [];
  for (const filePath of files) {
    sessions.push({
      sessionId: path.basename(path.dirname(filePath)),
      events: await readRelevantSessionEvents(filePath, { zstdcatPath })
    });
  }

  return summarizeDeepSeekSessions({ sessions, generatedAt, timeZone });
}

export async function findSessionFiles(sessionsRoot) {
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && entry.name === "session.jsonl.zstd") {
        files.push(entryPath);
      }
    }
  }

  try {
    await visit(sessionsRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export async function readRelevantSessionEvents(filePath, { zstdcatPath } = {}) {
  const command = zstdcatPath ?? await resolveZstdcatPath();
  const child = spawn(command, [filePath], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const completion = waitForChild(child, filePath);
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const events = [];
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) {
        continue;
      }
      const event = JSON.parse(line);
      if (isRelevantEvent(event)) {
        events.push(event);
      }
    }
    await completion;
  } catch (error) {
    child.kill();
    const detail = stderr.trim() ? ` ${stderr.trim()}` : "";
    throw new Error(`Could not read ${filePath} at JSONL line ${lineNumber}.${detail}`, { cause: error });
  }

  return events;
}

export function summarizeDeepSeekSessions({
  sessions = [],
  generatedAt = new Date(),
  timeZone = "Asia/Shanghai"
} = {}) {
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(generatedDate.getTime())) {
    throw new TypeError("generatedAt must be a valid date.");
  }

  const records = [];
  const sessionSummaries = [];
  for (const session of sessions) {
    const sessionRecords = collectSessionUsage(session, timeZone);
    records.push(...sessionRecords);
    sessionSummaries.push(summarizeUsageBucket({
      key: session.sessionId,
      records: sessionRecords,
      includeModels: true
    }));
  }

  records.sort((left, right) => left.time - right.time || left.sessionId.localeCompare(right.sessionId));
  const asOfDate = dateInTimeZone(generatedDate, timeZone);
  const dailyMap = new Map();
  const modelMap = new Map();
  const providerMap = new Map();

  for (const record of records) {
    mergeRecordIntoMap(dailyMap, record.date, record);
    mergeRecordIntoMap(modelMap, record.model, record);
    mergeRecordIntoMap(providerMap, record.provider, record);
  }

  const daily = [...dailyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({ date, ...bucket }));
  const totals = sumRecords(records);
  const firstUsageAt = records.length > 0 ? new Date(records[0].time).toISOString() : null;
  const lastUsageAt = records.length > 0 ? new Date(records.at(-1).time).toISOString() : null;

  return {
    schemaVersion: DEEPSEEK_DESKTOP_SCHEMA_VERSION,
    source: DEEPSEEK_DESKTOP_SOURCE,
    sourceFormat: "~/.dsh/sessions/**/session.jsonl.zstd",
    measurement: "provider-reported",
    generatedAt: generatedDate.toISOString(),
    timeZone,
    asOfDate,
    firstActivityDate: daily[0]?.date ?? asOfDate,
    firstUsageAt,
    lastUsageAt,
    sessionsScanned: sessions.length,
    usageSamples: records.length,
    totals,
    periods: {
      today: sumDailyRange(daily, asOfDate, asOfDate),
      thisWeek: sumDailyRange(daily, weekStartMonday(asOfDate), asOfDate),
      thisMonth: sumDailyRange(daily, `${asOfDate.slice(0, 7)}-01`, asOfDate),
      last7Days: sumDailyRange(daily, addDays(asOfDate, -6), asOfDate),
      last30Days: sumDailyRange(daily, addDays(asOfDate, -29), asOfDate),
      allTime: totals
    },
    providers: Object.fromEntries([...providerMap.entries()].sort(([left], [right]) => left.localeCompare(right))),
    models: Object.fromEntries([...modelMap.entries()].sort(([left], [right]) => left.localeCompare(right))),
    daily,
    sessions: sessionSummaries.sort((left, right) => left.sessionId.localeCompare(right.sessionId))
  };
}

function collectSessionUsage(session, timeZone) {
  const samples = [];
  let lastSample = null;
  let provider = "deepseek-official";
  let model = "unknown";

  for (const event of session.events ?? []) {
    if (event?.type === "request/context") {
      provider = event.data?.provider || provider;
      model = event.data?.model || model;
      continue;
    }

    const usage = usageFromEvent(event);
    if (!usage) {
      continue;
    }

    const turn = event.data?.turn;
    const step = event.data?.step;
    const time = normalizeTimestamp(event.time);
    const normalized = normalizeUsage(usage);
    const sample = {
      sessionId: session.sessionId,
      turn,
      step,
      time,
      date: dateInTimeZone(new Date(time), timeZone),
      provider,
      model,
      ...normalized,
      totalTokens: totalFromUsage(normalized)
    };

    if (lastSample?.turn === turn && lastSample?.step === step) {
      samples[lastSample.index] = sample;
    } else {
      samples.push(sample);
      lastSample = { turn, step, index: samples.length - 1 };
    }
  }

  return samples;
}

function usageFromEvent(event) {
  if (event?.type === "assistant/chunk" && event.data?.chunk?.type === "usage") {
    return event.data.chunk.usage;
  }
  if (event?.type === "assistant/message" && event.data?.usage) {
    return event.data.usage;
  }
  return null;
}

function isRelevantEvent(event) {
  return event?.type === "request/context" || usageFromEvent(event) !== null;
}

function normalizeUsage(usage) {
  return {
    inputTokens: nonnegativeNumber(usage.inputTokens),
    outputTokens: nonnegativeNumber(usage.outputTokens),
    cacheReadTokens: nonnegativeNumber(usage.cacheReadTokens),
    cacheWriteTokens: nonnegativeNumber(usage.cacheWriteTokens),
    reasoningTokens: nonnegativeNumber(usage.reasoningTokens)
  };
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new TypeError(`Invalid DeepSeek usage timestamp: ${value}`);
  }
  return timestamp;
}

function nonnegativeNumber(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`Invalid DeepSeek usage value: ${value}`);
  }
  return number;
}

function totalFromUsage(usage) {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}

function emptyUsageBucket() {
  return {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    requests: 0
  };
}

function sumRecords(records) {
  const bucket = emptyUsageBucket();
  for (const record of records) {
    mergeUsage(bucket, record);
  }
  return bucket;
}

function mergeUsage(target, usage) {
  target.totalTokens += usage.totalTokens ?? totalFromUsage(usage);
  target.inputTokens += usage.inputTokens ?? 0;
  target.outputTokens += usage.outputTokens ?? 0;
  target.cacheReadTokens += usage.cacheReadTokens ?? 0;
  target.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
  target.reasoningTokens += usage.reasoningTokens ?? 0;
  target.requests += usage.requests ?? 1;
}

function mergeRecordIntoMap(map, key, record) {
  const bucket = map.get(key) ?? emptyUsageBucket();
  mergeUsage(bucket, record);
  map.set(key, bucket);
}

function sumDailyRange(daily, startDate, endDate) {
  const bucket = emptyUsageBucket();
  for (const day of daily) {
    if (day.date >= startDate && day.date <= endDate) {
      mergeUsage(bucket, { ...day, requests: day.requests ?? 0 });
    }
  }
  return bucket;
}

function summarizeUsageBucket({ key, records, includeModels }) {
  const models = new Map();
  if (includeModels) {
    for (const record of records) {
      mergeRecordIntoMap(models, record.model, record);
    }
  }
  return {
    sessionId: key,
    firstUsageAt: records.length > 0 ? new Date(Math.min(...records.map((record) => record.time))).toISOString() : null,
    lastUsageAt: records.length > 0 ? new Date(Math.max(...records.map((record) => record.time))).toISOString() : null,
    totals: sumRecords(records),
    models: Object.fromEntries([...models.entries()].sort(([left], [right]) => left.localeCompare(right)))
  };
}

function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

async function resolveZstdcatPath() {
  const candidates = ["/opt/homebrew/bin/zstdcat", "/usr/local/bin/zstdcat"];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to the next standard installation path.
    }
  }
  return "zstdcat";
}

function waitForChild(child, filePath) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`zstdcat exited with status ${code} while reading ${filePath}.`));
      }
    });
  });
}

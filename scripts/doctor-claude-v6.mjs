#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./lib/claude-collector-v6.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = await readJson(path.join(root, "data", "claude-usage.json"));
const sync = await readJson(path.join(root, ".private", "sync-status-v6.json"));
const ageMinutes = snapshot ? Math.round((Date.now() - new Date(snapshot.generatedAt).getTime()) / 60000) : null;
console.log(JSON.stringify({ lastScanAt: snapshot?.generatedAt ?? null, ageMinutes,
  collectorStale: ageMinutes === null || ageMinutes > 20, health: snapshot?.health ?? null,
  sources: snapshot?.observedClaude?.coverage ?? null, desktop: snapshot?.desktop ?? null,
  chat: { status: snapshot?.chat?.status, lastImportedAt: snapshot?.chat?.lastImportedAt }, sync }, null, 2));
if (ageMinutes === null || ageMinutes > 20 || sync?.publication === "error" || sync?.tokscaleSubmit === "error" || sync?.tokscaleRefresh === "error" || snapshot?.health?.status === "degraded") process.exitCode = 2;

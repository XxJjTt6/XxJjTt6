#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

import { buildCommandEnv } from "./lib/tokscale-profile-refresh-v1.mjs";
import { buildSyncTokenPlan } from "./lib/sync-token-now-v3.mjs";

function hasArg(name) {
  return process.argv.includes(name);
}

function sleepSync(delayMs) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function runCommand(step, { dryRun = false, env = process.env } = {}) {
  const attempts = dryRun ? 1 : step.retry?.attempts ?? 1;
  let lastStatus = 0;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const retryLabel = attempts > 1 ? ` (${attempt}/${attempts})` : "";
    console.log(`[sync-token] ${step.label}${retryLabel}`);
    console.log(`$ ${step.command} ${step.args.join(" ")}`);

    if (dryRun) {
      return { status: 0 };
    }

    const result = spawnSync(step.command, step.args, {
      stdio: "inherit",
      env
    });

    if (result.error) {
      lastError = result.error;
    } else if (result.status === 0) {
      return result;
    }

    lastStatus = result.status ?? 1;
    if (attempt < attempts) {
      console.log(`[sync-token] ${step.label} failed; retrying in ${step.retry.delayMs / 1000}s.`);
      sleepSync(step.retry.delayMs);
    }
  }

  if (step.fallback?.length) {
    console.log(`[sync-token] ${step.label} did not finish; using local Tokscale graph fallback.`);
    for (const fallbackStep of step.fallback) {
      runCommand(fallbackStep, { dryRun, env });
    }
    return { status: 0 };
  }

  if (lastError) {
    throw lastError;
  }
  process.exit(lastStatus);
}

const dryRun = hasArg("--dry-run");
const env = buildCommandEnv(process.env);
const plan = buildSyncTokenPlan({
  clients: process.env.TOKSCALE_PROFILE_CLIENTS || "codex,claude",
  remote: process.env.TOKSCALE_PROFILE_REMOTE || "origin",
  branch: process.env.TOKSCALE_PROFILE_BRANCH || "main",
  message: process.env.TOKSCALE_PROFILE_COMMIT_MESSAGE || "chore: sync Tokscale token usage"
});

for (const step of plan) {
  runCommand(step, { dryRun, env });
}

console.log("[sync-token] Token sync pushed to GitHub.");

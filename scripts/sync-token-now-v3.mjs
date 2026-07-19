#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

import { buildCommandEnv } from "./lib/tokscale-profile-refresh-v1.mjs";
import { buildSyncTokenPlan } from "./lib/sync-token-now-v3.mjs";

function hasArg(name) {
  return process.argv.includes(name);
}

function runCommand(step, { dryRun = false, env = process.env } = {}) {
  console.log(`[sync-token] ${step.label}`);
  console.log(`$ ${step.command} ${step.args.join(" ")}`);

  if (dryRun) {
    return { status: 0 };
  }

  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
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

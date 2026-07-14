#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

import {
  PROFILE_REFRESH_DEFAULTS,
  buildCommandEnv,
  buildGhWorkflowRunCommand,
  buildTokscaleSubmitCommand
} from "./lib/tokscale-profile-refresh-v1.mjs";

function runStep(label, commandSpec, options = {}) {
  console.log(`[tokscale-profile-refresh] ${label}`);
  console.log(`$ ${commandSpec.command} ${commandSpec.args.join(" ")}`);

  if (options.dryRun) {
    return;
  }

  const result = spawnSync(commandSpec.command, commandSpec.args, {
    stdio: "inherit",
    env: options.env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const dryRun = process.argv.includes("--dry-run");
const env = buildCommandEnv(process.env);

const clients = process.env.TOKSCALE_PROFILE_CLIENTS || PROFILE_REFRESH_DEFAULTS.clients;
const repository = process.env.TOKSCALE_PROFILE_REPOSITORY || PROFILE_REFRESH_DEFAULTS.repository;
const workflow = process.env.TOKSCALE_PROFILE_WORKFLOW || PROFILE_REFRESH_DEFAULTS.workflow;
const ref = process.env.TOKSCALE_PROFILE_REF || PROFILE_REFRESH_DEFAULTS.ref;

runStep("Submitting local Codex and Claude usage to Tokscale", buildTokscaleSubmitCommand({ clients }), { dryRun, env });
runStep("Triggering GitHub profile refresh workflow", buildGhWorkflowRunCommand({ repository, workflow, ref }), { dryRun, env });

console.log("[tokscale-profile-refresh] Finished.");

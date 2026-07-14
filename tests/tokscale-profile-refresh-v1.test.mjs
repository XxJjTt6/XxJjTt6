import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommandEnv,
  buildGhWorkflowRunCommand,
  buildLaunchAgentPlist,
  buildTokscaleSubmitCommand
} from "../scripts/lib/tokscale-profile-refresh-v1.mjs";

test("buildTokscaleSubmitCommand submits Codex and Claude usage through Tokscale", () => {
  assert.deepEqual(buildTokscaleSubmitCommand(), {
    command: "npx",
    args: ["-y", "tokscale@latest", "submit", "--client", "codex,claude"]
  });
});

test("buildGhWorkflowRunCommand dispatches the fast profile refresh workflow", () => {
  assert.deepEqual(buildGhWorkflowRunCommand(), {
    command: "gh",
    args: [
      "workflow",
      "run",
      "refresh-tokscale-profile-fast.yml",
      "-R",
      "XxJjTt6/XxJjTt6",
      "--ref",
      "main"
    ]
  });
});

test("buildCommandEnv removes invalid GitHub token overrides and keeps Homebrew tools on PATH", () => {
  const env = buildCommandEnv({
    PATH: "/usr/bin:/bin",
    GITHUB_TOKEN: "invalid",
    HOME: "/Users/xjt"
  });

  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.HOME, "/Users/xjt");
  assert.match(env.PATH, /^\/opt\/homebrew\/bin:/);
  assert.match(env.PATH, /\/usr\/bin/);
});

test("buildLaunchAgentPlist creates a 15 minute launchd job for the sync script", () => {
  const plist = buildLaunchAgentPlist({
    label: "ai.tokscale.profile-refresh",
    nodePath: "/opt/homebrew/bin/node",
    scriptPath: "/repo/scripts/submit-and-trigger-profile-refresh-v1.mjs",
    workingDirectory: "/repo",
    logPath: "/Users/xjt/.config/tokscale/profile-refresh-v1/profile-refresh.log",
    intervalSeconds: 900
  });

  assert.match(plist, /<string>ai\.tokscale\.profile-refresh<\/string>/);
  assert.match(plist, /<string>\/opt\/homebrew\/bin\/node<\/string>/);
  assert.match(plist, /<string>\/repo\/scripts\/submit-and-trigger-profile-refresh-v1\.mjs<\/string>/);
  assert.match(plist, /<key>StartInterval<\/key>\n\s*<integer>900<\/integer>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\n\s*<true\/>/);
});

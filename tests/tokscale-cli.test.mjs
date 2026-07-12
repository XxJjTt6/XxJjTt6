import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildGenerateProfileCommand,
  buildTokscaleGraphCommand,
  parseUpdateArgs
} from "../scripts/lib/tokscale-cli.mjs";

test("parseUpdateArgs keeps the intended Codex and Claude Code defaults", () => {
  const args = parseUpdateArgs([]);
  assert.equal(args.clients, "codex,claude");
  assert.equal(args.since, "2026-01-01");
  assert.equal(args.profileName, "XxJjTt6");
  assert.equal(args.handle, "@XxJjTt6");
  assert.equal(args.rankText, "Private");
});

test("buildTokscaleGraphCommand creates a deterministic graph export command", () => {
  const outDir = "/tmp/profile-out";
  const command = buildTokscaleGraphCommand({
    outDir,
    clients: "codex,claude",
    since: "2026-01-01",
    until: "2026-07-13",
    homeDir: "/Users/xjt"
  });

  assert.equal(command.command, "npx");
  assert.deepEqual(command.args.slice(0, 12), [
    "-y",
    "tokscale@latest",
    "graph",
    "--client",
    "codex,claude",
    "--since",
    "2026-01-01",
    "--until",
    "2026-07-13",
    "--no-spinner",
    "--output",
    path.join(outDir, "data", "tokscale-graph.json")
  ]);
  assert.deepEqual(command.args.slice(-2), ["--home", "/Users/xjt"]);
});

test("buildGenerateProfileCommand points at the generated graph", () => {
  const outDir = "/tmp/profile-out";
  const command = buildGenerateProfileCommand({
    outDir,
    profileName: "XxJjTt6",
    handle: "@XxJjTt6",
    rankText: "Private"
  });

  assert.equal(command.command, process.execPath);
  assert.equal(command.args[0], path.join(outDir, "scripts", "generate-tokscale-profile.mjs"));
  assert.equal(command.args.includes(path.join(outDir, "data", "tokscale-graph.json")), true);
});

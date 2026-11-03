#!/usr/bin/env node
import fs from "node:fs";
import { decideAdaptiveSync, readOwnerCommitDates } from "./lib/adaptive-profile-sync-v1.mjs";

const graph = JSON.parse(fs.readFileSync("data/tokscale-graph.json", "utf8"));
const decision = decideAdaptiveSync({ graph, commitDates: readOwnerCommitDates(process.cwd()) });
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `commit=${decision.shouldCommit}\n`);
console.log(JSON.stringify(decision));

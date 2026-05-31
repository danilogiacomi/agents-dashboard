#!/usr/bin/env bun
import index from "../web/index.html";
import { runCcusage, runCcusageBlocks } from "./ccusage";
import { readLatestCodexRateLimits } from "./codex-logs";
import { handleCurrentUsage } from "./current-usage-handler";
import { handleUsage } from "./usage-handler";

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/api/usage": {
      GET: (req) => handleUsage(req, { run: runCcusage, now: () => new Date() }),
    },
    "/api/current-usage": {
      GET: (req) =>
        handleCurrentUsage(req, {
          runBlocks: (tool) => runCcusageBlocks(tool),
          readCodexRateLimits: readLatestCodexRateLimits,
          isClaudeCodeShell: () => process.env.CLAUDECODE === "1",
        }),
    },
  },
});

console.log(`Agents Dashboard running at http://localhost:${server.port}`);
console.log("⭐ Enjoying it? Star the project: https://github.com/danilogiacomi/agents-dashboard");

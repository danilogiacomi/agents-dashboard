import type { CcusageDailyReport, CcusageSessionReport, CodexRateLimits } from "../../src/types";

export const sampleSession: CcusageSessionReport = {
  sessions: [
    {
      sessionId: "s1",
      projectPath: "-proj-a",
      lastActivity: "2026-05-29",
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationTokens: 300,
      cacheReadTokens: 400,
      totalTokens: 1000,
      totalCost: 5,
      modelsUsed: ["claude-opus-4-8"],
      modelBreakdowns: [
        {
          modelName: "claude-opus-4-8",
          inputTokens: 100,
          outputTokens: 200,
          cacheCreationTokens: 300,
          cacheReadTokens: 400,
          cost: 5,
        },
      ],
    },
    {
      sessionId: "s2",
      projectPath: "-proj-b",
      lastActivity: "2026-05-30",
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 30,
      cacheReadTokens: 40,
      totalTokens: 100,
      totalCost: 2,
      modelsUsed: ["claude-opus-4-8", "claude-sonnet-4-6"],
      modelBreakdowns: [
        {
          modelName: "claude-opus-4-8",
          inputTokens: 6,
          outputTokens: 12,
          cacheCreationTokens: 18,
          cacheReadTokens: 24,
          cost: 1.5,
        },
        {
          modelName: "claude-sonnet-4-6",
          inputTokens: 4,
          outputTokens: 8,
          cacheCreationTokens: 12,
          cacheReadTokens: 16,
          cost: 0.5,
        },
      ],
    },
  ],
};

export const sampleDaily: CcusageDailyReport = {
  daily: [
    {
      date: "2026-05-29",
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationTokens: 300,
      cacheReadTokens: 400,
      totalTokens: 1000,
      totalCost: 5,
      modelsUsed: ["claude-opus-4-8"],
      modelBreakdowns: [],
    },
    {
      date: "2026-05-30",
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 30,
      cacheReadTokens: 40,
      totalTokens: 100,
      totalCost: 2,
      modelsUsed: ["claude-opus-4-8", "claude-sonnet-4-6"],
      modelBreakdowns: [],
    },
  ],
};

export const emptySession: CcusageSessionReport = { sessions: [] };
export const emptyDaily: CcusageDailyReport = { daily: [] };

// Raw, non-canonical shapes as emitted by `ccusage codex --json`: cost is `costUSD`,
// project is `directory`, models is a map (not a string[]), and there is no
// `modelBreakdowns`. Typed as `unknown` because they intentionally do not match the
// canonical CcusageSessionReport/CcusageDailyReport types.
export const codexSessionRaw: unknown = {
  sessions: [
    {
      sessionId: "cx1",
      directory: "/home/u/proj",
      lastActivity: "2026-05-30",
      inputTokens: 73183,
      outputTokens: 7778,
      cachedInputTokens: 372224,
      reasoningOutputTokens: 3396,
      totalTokens: 453185,
      costUSD: 1.25,
      models: {
        "gpt-5.4": {
          cachedInputTokens: 372224,
          inputTokens: 73183,
          isFallback: false,
          outputTokens: 7778,
          reasoningOutputTokens: 3396,
          totalTokens: 453185,
        },
      },
      sessionFile: "/x.jsonl",
    },
  ],
  totals: { totalCost: 1.25 },
};

export const codexDailyRaw: unknown = {
  daily: [
    {
      date: "2026-05-30",
      inputTokens: 73183,
      outputTokens: 7778,
      cachedInputTokens: 372224,
      reasoningOutputTokens: 3396,
      totalTokens: 453185,
      costUSD: 1.25,
      models: { "gpt-5.4": { totalTokens: 453185 } },
    },
  ],
  totals: {},
};

export const codexRateLimitsSample: CodexRateLimits = {
  // 5-hour window, 62% used, resets at 2026-05-31T14:00:00Z (1780236000)
  secondary: { used_percent: 62, window_minutes: 300, resets_at: 1780236000 },
  // weekly window, 31% used, resets at a later time (1780738238)
  primary: { used_percent: 31, window_minutes: 10080, resets_at: 1780738238 },
};

import type { CcusageDailyReport, CcusageSessionReport } from "../../src/types";

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

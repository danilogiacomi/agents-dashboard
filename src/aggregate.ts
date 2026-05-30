import type {
  CcusageDailyReport,
  CcusageSessionReport,
  DashboardData,
  ModelAgg,
  RangeMeta,
} from "./types";

export function aggregate(
  daily: CcusageDailyReport,
  session: CcusageSessionReport,
  meta: RangeMeta,
): DashboardData {
  const dailyPoints = daily.daily.map((d) => ({
    date: d.date,
    cost: d.totalCost,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    cacheCreationTokens: d.cacheCreationTokens,
    cacheReadTokens: d.cacheReadTokens,
    totalTokens: d.totalTokens,
  }));

  const sessions = session.sessions.map((s) => ({
    sessionId: s.sessionId,
    projectPath: s.projectPath,
    modelsUsed: s.modelsUsed,
    totalTokens: s.totalTokens,
    totalCost: s.totalCost,
    lastActivity: s.lastActivity,
  }));

  const modelMap = new Map<string, ModelAgg>();
  for (const s of session.sessions) {
    for (const b of s.modelBreakdowns) {
      const m = modelMap.get(b.modelName) ?? {
        model: b.modelName,
        cost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };
      m.cost += b.cost;
      m.inputTokens += b.inputTokens;
      m.outputTokens += b.outputTokens;
      m.cacheCreationTokens += b.cacheCreationTokens;
      m.cacheReadTokens += b.cacheReadTokens;
      m.totalTokens += b.inputTokens + b.outputTokens + b.cacheCreationTokens + b.cacheReadTokens;
      modelMap.set(b.modelName, m);
    }
  }
  const byModel = [...modelMap.values()].sort((a, b) => b.cost - a.cost);

  const tokenSplit = session.sessions.reduce(
    (acc, s) => {
      acc.input += s.inputTokens;
      acc.output += s.outputTokens;
      acc.cacheCreate += s.cacheCreationTokens;
      acc.cacheRead += s.cacheReadTokens;
      return acc;
    },
    { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
  );

  const totalCost = sessions.reduce((a, s) => a + s.totalCost, 0);
  const totalTokens = sessions.reduce((a, s) => a + s.totalTokens, 0);
  const activeDays = dailyPoints.filter((d) => d.totalTokens > 0).length;

  return {
    range: meta,
    kpis: { totalCost, totalTokens, sessionCount: sessions.length, activeDays },
    daily: dailyPoints,
    byModel,
    tokenSplit,
    sessions,
  };
}

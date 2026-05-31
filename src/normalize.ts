import { CcusageError } from "./ccusage";
import type {
  CcusageDailyEntry,
  CcusageDailyReport,
  CcusageModelBreakdown,
  CcusageSession,
  CcusageSessionReport,
} from "./types";

// ccusage emits a different JSON schema per tool. claude uses `totalCost`,
// `projectPath`, `modelsUsed: string[]`, and `modelBreakdowns: [...]`; codex uses
// `costUSD`, `directory`, a `models` map keyed by model name, and ships no
// per-model breakdowns. These helpers map any tool's raw output into the canonical
// shapes the rest of the app consumes, defaulting anything missing so aggregate()
// never sees `undefined` (which previously caused an opaque 500).

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj {
  return v && typeof v === "object" ? (v as Obj) : {};
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Per-tool field aliases.
function pickCost(o: Obj): number {
  return num(o.totalCost ?? o.costUSD);
}
function pickProject(o: Obj): string {
  return str(o.projectPath ?? o.directory);
}
function pickCacheRead(o: Obj): number {
  return num(o.cacheReadTokens ?? o.cachedInputTokens);
}

// Model names may come from `modelsUsed: string[]` (claude), a `models: string[]`,
// or a `models` object map keyed by model name (codex).
function modelNames(o: Obj): string[] {
  if (Array.isArray(o.modelsUsed)) {
    return o.modelsUsed.filter((m): m is string => typeof m === "string");
  }
  const models = o.models;
  if (Array.isArray(models)) {
    return models.filter((m): m is string => typeof m === "string");
  }
  if (models && typeof models === "object") {
    return Object.keys(models);
  }
  return [];
}

function normalizeBreakdowns(v: unknown): CcusageModelBreakdown[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const o = asObj(raw);
    return {
      modelName: str(o.modelName),
      inputTokens: num(o.inputTokens),
      outputTokens: num(o.outputTokens),
      cacheCreationTokens: num(o.cacheCreationTokens),
      cacheReadTokens: pickCacheRead(o),
      cost: num(o.cost),
    };
  });
}

function normalizeSession(raw: unknown): CcusageSession {
  const o = asObj(raw);
  return {
    sessionId: str(o.sessionId),
    projectPath: pickProject(o),
    lastActivity: str(o.lastActivity),
    inputTokens: num(o.inputTokens),
    outputTokens: num(o.outputTokens),
    cacheCreationTokens: num(o.cacheCreationTokens),
    cacheReadTokens: pickCacheRead(o),
    totalTokens: num(o.totalTokens),
    totalCost: pickCost(o),
    modelsUsed: modelNames(o),
    modelBreakdowns: normalizeBreakdowns(o.modelBreakdowns),
  };
}

function normalizeDaily(raw: unknown): CcusageDailyEntry {
  const o = asObj(raw);
  return {
    date: str(o.date),
    inputTokens: num(o.inputTokens),
    outputTokens: num(o.outputTokens),
    cacheCreationTokens: num(o.cacheCreationTokens),
    cacheReadTokens: pickCacheRead(o),
    totalTokens: num(o.totalTokens),
    totalCost: pickCost(o),
    modelsUsed: modelNames(o),
    modelBreakdowns: normalizeBreakdowns(o.modelBreakdowns),
  };
}

export function normalizeSessionReport(raw: unknown): CcusageSessionReport {
  const sessions = asObj(raw).sessions;
  if (!Array.isArray(sessions)) {
    throw new CcusageError("ccusage returned an unexpected session report shape");
  }
  return { sessions: sessions.map(normalizeSession) };
}

export function normalizeDailyReport(raw: unknown): CcusageDailyReport {
  const daily = asObj(raw).daily;
  if (!Array.isArray(daily)) {
    throw new CcusageError("ccusage returned an unexpected daily report shape");
  }
  return { daily: daily.map(normalizeDaily) };
}

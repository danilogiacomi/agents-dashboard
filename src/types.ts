// --- ccusage --json shapes (subset we consume) ---
export interface CcusageModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface CcusageSession {
  sessionId: string;
  projectPath: string;
  lastActivity: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: CcusageModelBreakdown[];
}
export interface CcusageSessionReport {
  sessions: CcusageSession[];
}

export interface CcusageDailyEntry {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: CcusageModelBreakdown[];
}
export interface CcusageDailyReport {
  daily: CcusageDailyEntry[];
}

// --- domain ---
export const SUPPORTED_TOOLS = [
  "claude",
  "codex",
  "opencode",
  "gemini",
  "copilot",
  "amp",
  "droid",
  "goose",
] as const;
export type Tool = (typeof SUPPORTED_TOOLS)[number];

export type TemplateId =
  | "today"
  | "last-7-days"
  | "this-month"
  | "last-month"
  | "last-30-days"
  | "all-time"
  | "custom";

export interface DateRange {
  since?: string;
  until?: string;
}

export interface RangeMeta {
  tool: string;
  template: TemplateId;
  since?: string;
  until?: string;
}

export interface Kpis {
  totalCost: number;
  totalTokens: number;
  sessionCount: number;
  activeDays: number;
}

export interface DailyPoint {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export interface ModelAgg {
  model: string;
  cost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface TokenSplit {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}

export interface SessionRow {
  sessionId: string;
  projectPath: string;
  modelsUsed: string[];
  totalTokens: number;
  totalCost: number;
  lastActivity: string;
}

export interface DashboardData {
  range: RangeMeta;
  kpis: Kpis;
  daily: DailyPoint[];
  byModel: ModelAgg[];
  tokenSplit: TokenSplit;
  sessions: SessionRow[];
}

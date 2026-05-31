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

// --- current usage (rate-limit snapshot) ---
export interface UsageWindow {
  label: string; // "5-hour session", "Weekly", or "{n}-hour"/"{n}-day"
  usedPercent: number; // 0–100
  resetsAt: string; // ISO 8601, absolute
  basis: "exact" | "estimate";
  detail?: string; // e.g. "21.5M tokens"
}
export interface CurrentUsage {
  tool: string;
  available: boolean;
  windows: UsageWindow[];
  note?: string;
}

// Codex rollout `rate_limits` shape (subset we consume).
export interface CodexRateWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number; // unix seconds
}
export interface CodexRateLimits {
  primary: CodexRateWindow | null;
  secondary: CodexRateWindow | null;
}

import type { CodexRateLimits, CodexRateWindow, CurrentUsage, UsageWindow } from "./types";

export function labelForWindow(minutes: number): string {
  if (minutes === 300) return "5-hour session";
  if (minutes === 10080) return "Weekly";
  if (minutes % 1440 === 0) return `${minutes / 1440}-day`;
  return `${Math.round(minutes / 60)}-hour`;
}

function codexWindow(w: CodexRateWindow): UsageWindow {
  return {
    label: labelForWindow(w.window_minutes),
    usedPercent: Math.max(0, Math.min(100, w.used_percent)),
    resetsAt: new Date(w.resets_at * 1000).toISOString(),
    basis: "exact",
  };
}

export function deriveCodexUsage(rl: CodexRateLimits | null): CurrentUsage {
  if (!rl || (!rl.primary && !rl.secondary)) {
    return { tool: "codex", available: false, windows: [], note: "no rate-limit data in the latest Codex session log" };
  }
  const windows = [rl.secondary, rl.primary].filter((w): w is CodexRateWindow => w != null).map(codexWindow);
  return { tool: "codex", available: true, windows };
}

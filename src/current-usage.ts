import type { CodexRateLimits, CodexRateWindow, CurrentUsage, UsageWindow } from "./types";

export function labelForWindow(minutes: number): string {
  if (minutes === 300) return "5-hour session";
  if (minutes === 10080) return "Weekly";
  if (minutes % 1440 === 0) return `${minutes / 1440}-day`;
  return `${Math.round(minutes / 60)}-hour`;
}

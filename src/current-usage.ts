import type { CodexRateLimits, CodexRateWindow, CurrentUsage, UsageWindow } from "./types";

export interface CurrentUsageDeps {
  runBlocks: (tool: string) => Promise<unknown>;
  readCodexRateLimits: () => Promise<CodexRateLimits | null>;
  isClaudeCodeShell: () => boolean;
}

export async function getCurrentUsage(tool: string, deps: CurrentUsageDeps): Promise<CurrentUsage> {
  if (tool === "claude") {
    if (!deps.isClaudeCodeShell()) {
      return {
        tool,
        available: false,
        windows: [],
        note: "Claude current usage is only available when this dashboard is launched from Claude Code.",
      };
    }
    return deriveClaudeUsage(await deps.runBlocks("claude"));
  }
  if (tool === "codex") return deriveCodexUsage(await deps.readCodexRateLimits());
  return {
    tool,
    available: false,
    windows: [],
    note: "current usage not available for this agent yet",
  };
}

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
    return {
      tool: "codex",
      available: false,
      windows: [],
      note: "no rate-limit data in the latest Codex session log",
    };
  }
  const windows = [rl.secondary, rl.primary]
    .filter((w): w is CodexRateWindow => w != null)
    .map(codexWindow);
  return { tool: "codex", available: true, windows };
}

interface ClaudeBlock {
  isActive?: boolean;
  isGap?: boolean;
  endTime?: string;
  totalTokens?: number;
}

const CLAUDE_ESTIMATE_NOTE =
  "Estimate: % is relative to your busiest 5-hour block, not a real plan limit (Claude does not expose quota locally).";

function humanTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M tokens`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K tokens`;
  return `${n} tokens`;
}

export function deriveClaudeUsage(raw: unknown): CurrentUsage {
  const blocks: ClaudeBlock[] = Array.isArray((raw as { blocks?: unknown })?.blocks)
    ? (raw as { blocks: ClaudeBlock[] }).blocks
    : [];
  const active = blocks.find((b) => b.isActive && !b.isGap);
  if (!active || !active.endTime) {
    return {
      tool: "claude",
      available: true,
      windows: [],
      note: "no active session in the last 5 hours",
    };
  }
  const peak = Math.max(0, ...blocks.filter((b) => !b.isGap).map((b) => b.totalTokens ?? 0));
  const used = active.totalTokens ?? 0;
  const usedPercent = peak > 0 ? Math.max(0, Math.min(100, (used / peak) * 100)) : 0;
  return {
    tool: "claude",
    available: true,
    windows: [
      {
        label: "5-hour session",
        usedPercent,
        resetsAt: new Date(active.endTime).toISOString(),
        basis: "estimate",
        detail: humanTokens(used),
      },
    ],
    note: CLAUDE_ESTIMATE_NOTE,
  };
}

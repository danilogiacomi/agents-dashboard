// Pure display helpers for the sessions table (no DOM, unit-tested in test/format.test.ts).

import type { SessionRow } from "../src/types";

export interface ProjectRow {
  projectPath: string;
  modelsUsed: string[];
  totalTokens: number;
  totalCost: number;
  lastActivity: string;
  sessionCount: number;
}

/**
 * Collapse per-session rows into one row per project: tokens/cost summed, models unioned
 * (order-preserving, deduped), lastActivity = latest, plus a session count. Project order
 * follows first appearance in the input.
 */
export function aggregateByProject(sessions: SessionRow[]): ProjectRow[] {
  const byProject = new Map<string, ProjectRow>();
  for (const s of sessions) {
    let row = byProject.get(s.projectPath);
    if (!row) {
      row = {
        projectPath: s.projectPath,
        modelsUsed: [],
        totalTokens: 0,
        totalCost: 0,
        lastActivity: "",
        sessionCount: 0,
      };
      byProject.set(s.projectPath, row);
    }
    row.totalTokens += s.totalTokens;
    row.totalCost += s.totalCost;
    row.sessionCount += 1;
    if (s.lastActivity > row.lastActivity) row.lastActivity = s.lastActivity;
    for (const m of s.modelsUsed) {
      if (!row.modelsUsed.includes(m)) row.modelsUsed.push(m);
    }
  }
  return [...byProject.values()];
}

/** "claude-opus-4-8" -> "opus 4.8"; names that don't match pass through unchanged. */
export function shortModel(full: string): string {
  const m = full.match(/^claude-([a-z]+)-(\d+)-(\d+)/i);
  if (m) return `${m[1]} ${m[2]}.${m[3]}`;
  return full;
}

/**
 * Build a labeler that drops the path segments common to every project, leaving only
 * the distinguishing tail (always keeping at least the last segment). Project paths are
 * ccusage's dash-encoded cwd, e.g. "-Users-danilo-Progetti-DICE-game1". The common prefix
 * is derived from the given paths, so it adapts to the user's environment automatically.
 */
export function projectLabeler(paths: string[]): (p: string) => string {
  const split = (p: string): string[] => p.replace(/^-+/, "").split("-").filter(Boolean);
  const lists = paths.map(split);

  let common = 0;
  const first = lists[0];
  if (first) {
    while (common < first.length && lists.every((segs) => segs[common] === first[common])) {
      common++;
    }
  }

  return (p: string): string => {
    const segs = split(p);
    if (segs.length === 0) return p;
    const start = Math.min(common, segs.length - 1); // keep at least the last segment
    return segs.slice(start).join("/");
  };
}

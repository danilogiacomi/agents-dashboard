import { describe, expect, test } from "bun:test";
import { aggregate } from "../src/aggregate";
import type { RangeMeta } from "../src/types";
import { emptyDaily, emptySession, sampleDaily, sampleSession } from "./fixtures/sample";

const meta: RangeMeta = {
  tool: "claude",
  template: "last-7-days",
  since: "2026-05-24",
  until: "2026-05-30",
};

describe("aggregate", () => {
  const data = aggregate(sampleDaily, sampleSession, meta);

  test("passes range meta through", () => {
    expect(data.range).toEqual(meta);
  });
  test("computes KPIs", () => {
    expect(data.kpis).toEqual({ totalCost: 7, totalTokens: 1100, sessionCount: 2, activeDays: 2 });
  });
  test("builds daily points in order", () => {
    expect(data.daily.map((d) => d.date)).toEqual(["2026-05-29", "2026-05-30"]);
    expect(data.daily[0]?.cost).toBe(5);
  });
  test("aggregates by model, sorted by cost desc", () => {
    expect(data.byModel.map((m) => m.model)).toEqual(["claude-opus-4-8", "claude-sonnet-4-6"]);
    expect(data.byModel[0]?.cost).toBe(6.5); // 5 + 1.5
    expect(data.byModel[1]?.cost).toBe(0.5);
  });
  test("sums token split across sessions", () => {
    expect(data.tokenSplit).toEqual({ input: 110, output: 220, cacheCreate: 330, cacheRead: 440 });
  });
  test("maps sessions to rows", () => {
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0]?.projectPath).toBe("-proj-a");
  });

  test("empty reports yield zeroed dashboard", () => {
    const empty = aggregate(emptyDaily, emptySession, meta);
    expect(empty.kpis).toEqual({ totalCost: 0, totalTokens: 0, sessionCount: 0, activeDays: 0 });
    expect(empty.byModel).toEqual([]);
    expect(empty.sessions).toEqual([]);
  });
});

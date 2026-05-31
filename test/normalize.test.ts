import { describe, expect, test } from "bun:test";
import { CcusageError } from "../src/ccusage";
import { normalizeDailyReport, normalizeSessionReport } from "../src/normalize";
import { codexDailyRaw, codexSessionRaw, sampleDaily, sampleSession } from "./fixtures/sample";

describe("normalizeSessionReport", () => {
  test("passes a canonical (claude) report through unchanged", () => {
    const out = normalizeSessionReport(sampleSession);
    expect(out.sessions).toHaveLength(2);
    const s = out.sessions[0];
    expect(s?.totalCost).toBe(5);
    expect(s?.projectPath).toBe("-proj-a");
    expect(s?.modelsUsed).toEqual(["claude-opus-4-8"]);
    expect(s?.modelBreakdowns).toHaveLength(1);
  });

  test("normalizes a codex report (alias fields, models map, no breakdowns)", () => {
    const out = normalizeSessionReport(codexSessionRaw);
    expect(out.sessions).toHaveLength(1);
    const s = out.sessions[0];
    expect(s?.totalCost).toBe(1.25); // from costUSD
    expect(s?.projectPath).toBe("/home/u/proj"); // from directory
    expect(s?.modelsUsed).toEqual(["gpt-5.4"]); // from models map keys
    expect(s?.cacheReadTokens).toBe(372224); // from cachedInputTokens
    expect(s?.modelBreakdowns).toEqual([]); // codex has none
    expect(s?.totalTokens).toBe(453185);
  });

  test("throws CcusageError when sessions is not an array", () => {
    expect(() => normalizeSessionReport({})).toThrow(CcusageError);
    expect(() => normalizeSessionReport(null)).toThrow(CcusageError);
  });
});

describe("normalizeDailyReport", () => {
  test("passes a canonical (claude) daily report through unchanged", () => {
    const out = normalizeDailyReport(sampleDaily);
    expect(out.daily).toHaveLength(2);
    expect(out.daily[0]?.totalCost).toBe(5);
    expect(out.daily[0]?.date).toBe("2026-05-29");
  });

  test("normalizes a codex daily report", () => {
    const out = normalizeDailyReport(codexDailyRaw);
    expect(out.daily).toHaveLength(1);
    const d = out.daily[0];
    expect(d?.totalCost).toBe(1.25); // from costUSD
    expect(d?.totalTokens).toBe(453185);
    expect(d?.modelsUsed).toEqual(["gpt-5.4"]);
    expect(d?.modelBreakdowns).toEqual([]);
  });

  test("throws CcusageError when daily is not an array", () => {
    expect(() => normalizeDailyReport({})).toThrow(CcusageError);
  });
});

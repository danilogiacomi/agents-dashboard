import { describe, expect, test } from "bun:test";
import { deriveClaudeUsage, deriveCodexUsage, labelForWindow } from "../src/current-usage";
import { claudeBlocksNoActive, claudeBlocksRaw, codexRateLimitsSample } from "./fixtures/sample";

describe("labelForWindow", () => {
  test("maps the 5-hour window", () => {
    expect(labelForWindow(300)).toBe("5-hour session");
  });
  test("maps the weekly window", () => {
    expect(labelForWindow(10080)).toBe("Weekly");
  });
  test("formats whole-day windows", () => {
    expect(labelForWindow(2880)).toBe("2-day");
  });
  test("falls back to hours", () => {
    expect(labelForWindow(180)).toBe("3-hour");
  });
});

describe("deriveCodexUsage", () => {
  test("emits one exact window per present sub-window", () => {
    const u = deriveCodexUsage(codexRateLimitsSample);
    expect(u.available).toBe(true);
    expect(u.windows).toHaveLength(2);
    const five = u.windows.find((w) => w.label === "5-hour session");
    expect(five).toBeDefined();
    expect(five?.usedPercent).toBe(62);
    expect(five?.basis).toBe("exact");
    expect(five?.resetsAt).toBe("2026-05-31T14:00:00.000Z");
    expect(u.windows.some((w) => w.label === "Weekly")).toBe(true);
  });

  test("skips a null secondary window", () => {
    const u = deriveCodexUsage({
      primary: { used_percent: 10, window_minutes: 10080, resets_at: 1780738238 },
      secondary: null,
    });
    expect(u.windows).toHaveLength(1);
    expect(u.windows[0]?.label).toBe("Weekly");
  });

  test("reports unavailable when there are no rate limits", () => {
    const u = deriveCodexUsage(null);
    expect(u.available).toBe(false);
    expect(u.windows).toHaveLength(0);
    expect(u.note).toBeTruthy();
  });
});

describe("deriveClaudeUsage", () => {
  test("estimates percent against the historical-peak block", () => {
    const u = deriveClaudeUsage(claudeBlocksRaw);
    expect(u.available).toBe(true);
    expect(u.windows).toHaveLength(1);
    const w = u.windows[0];
    expect(w?.label).toBe("5-hour session");
    expect(w?.basis).toBe("estimate");
    expect(w?.usedPercent).toBe(50);
    expect(w?.resetsAt).toBe("2026-05-31T13:00:00.000Z");
    expect(u.note).toBeTruthy();
  });

  test("reports no active session when none is active", () => {
    const u = deriveClaudeUsage(claudeBlocksNoActive);
    expect(u.available).toBe(true);
    expect(u.windows).toHaveLength(0);
    expect(u.note).toContain("no active session");
  });

  test("handles a zero historical peak without dividing by zero", () => {
    const u = deriveClaudeUsage({
      blocks: [{ id: "a", isActive: true, isGap: false, endTime: "2026-05-31T13:00:00.000Z", totalTokens: 0 }],
    });
    expect(u.windows[0]?.usedPercent).toBe(0);
  });
});

import { describe, expect, test } from "bun:test";
import { parseRateLimitsFromJsonl } from "../src/codex-logs";

const win = (used: number) => ({
  used_percent: used,
  window_minutes: 10080,
  resets_at: 1780738238,
});

describe("parseRateLimitsFromJsonl", () => {
  test("reads rate_limits from the current payload.rate_limits shape", () => {
    const text = JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {},
        rate_limits: { primary: win(31), secondary: null },
      },
    });
    expect(parseRateLimitsFromJsonl(text)?.primary?.used_percent).toBe(31);
  });

  test("falls back to the older nested payload.info.rate_limits shape", () => {
    const text = JSON.stringify({
      payload: { info: { rate_limits: { primary: win(12), secondary: null } } },
    });
    expect(parseRateLimitsFromJsonl(text)?.primary?.used_percent).toBe(12);
  });

  test("keeps the LAST snapshot across multiple lines, ignoring malformed lines", () => {
    const lines = [
      JSON.stringify({ payload: { rate_limits: { primary: win(10), secondary: null } } }),
      "{ this is not valid json but mentions rate_limits",
      "",
      JSON.stringify({ payload: { rate_limits: { primary: win(55), secondary: null } } }),
    ].join("\n");
    expect(parseRateLimitsFromJsonl(lines)?.primary?.used_percent).toBe(55);
  });

  test("returns null when no line contains rate_limits", () => {
    const text = `${JSON.stringify({ payload: { type: "message" } })}\n${JSON.stringify({ a: 1 })}`;
    expect(parseRateLimitsFromJsonl(text)).toBeNull();
  });
});

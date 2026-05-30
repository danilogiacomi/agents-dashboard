import { describe, expect, test } from "bun:test";
import { fmt, resolveRange } from "../src/ranges";

// Fixed "now": Saturday 2026-05-30 (local components only, TZ-independent)
const NOW = new Date(2026, 4, 30);

describe("fmt", () => {
  test("formats local date as YYYY-MM-DD", () => {
    expect(fmt(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("resolveRange", () => {
  test("today", () => {
    expect(resolveRange("today", NOW)).toEqual({ since: "2026-05-30", until: "2026-05-30" });
  });
  test("last-7-days", () => {
    expect(resolveRange("last-7-days", NOW)).toEqual({ since: "2026-05-24", until: "2026-05-30" });
  });
  test("last-30-days", () => {
    expect(resolveRange("last-30-days", NOW)).toEqual({ since: "2026-05-01", until: "2026-05-30" });
  });
  test("this-month", () => {
    expect(resolveRange("this-month", NOW)).toEqual({ since: "2026-05-01", until: "2026-05-30" });
  });
  test("last-month spans the full previous calendar month", () => {
    expect(resolveRange("last-month", NOW)).toEqual({ since: "2026-04-01", until: "2026-04-30" });
  });
  test("all-time omits both bounds", () => {
    expect(resolveRange("all-time", NOW)).toEqual({});
  });
  test("custom passes valid dates through", () => {
    expect(resolveRange("custom", NOW, { since: "2026-01-01", until: "2026-02-01" })).toEqual({
      since: "2026-01-01",
      until: "2026-02-01",
    });
  });
  test("custom rejects missing dates", () => {
    expect(() => resolveRange("custom", NOW, { since: "2026-01-01" })).toThrow();
  });
  test("custom rejects bad format", () => {
    expect(() =>
      resolveRange("custom", NOW, { since: "01/01/2026", until: "2026-02-01" }),
    ).toThrow();
  });
  test("custom rejects since after until", () => {
    expect(() =>
      resolveRange("custom", NOW, { since: "2026-03-01", until: "2026-02-01" }),
    ).toThrow();
  });
});

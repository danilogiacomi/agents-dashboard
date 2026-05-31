import { describe, expect, test } from "bun:test";
import { labelForWindow } from "../src/current-usage";

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

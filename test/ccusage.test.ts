import { describe, expect, test } from "bun:test";
import { buildCcusageArgs } from "../src/ccusage";

describe("buildCcusageArgs", () => {
  test("includes since and until when present", () => {
    expect(
      buildCcusageArgs("claude", "daily", { since: "2026-05-01", until: "2026-05-02" }),
    ).toEqual(["claude", "daily", "--json", "--since", "2026-05-01", "--until", "2026-05-02"]);
  });
  test("omits bounds for all-time (empty range)", () => {
    expect(buildCcusageArgs("codex", "session", {})).toEqual(["codex", "session", "--json"]);
  });
  test("includes only since when until missing", () => {
    expect(buildCcusageArgs("claude", "session", { since: "2026-05-01" })).toEqual([
      "claude",
      "session",
      "--json",
      "--since",
      "2026-05-01",
    ]);
  });
});

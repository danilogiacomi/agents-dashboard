import { describe, expect, test } from "bun:test";
import type { SessionRow } from "../src/types";
import {
  aggregateByProject,
  fmtCountdown,
  fmtPercent,
  projectLabeler,
  shortModel,
} from "../web/format";

function session(over: Partial<SessionRow>): SessionRow {
  return {
    sessionId: "s",
    projectPath: "-p",
    modelsUsed: [],
    totalTokens: 0,
    totalCost: 0,
    lastActivity: "2026-01-01",
    ...over,
  };
}

describe("shortModel", () => {
  test("shortens claude model names to 'family major.minor'", () => {
    expect(shortModel("claude-opus-4-8")).toBe("opus 4.8");
    expect(shortModel("claude-sonnet-4-6")).toBe("sonnet 4.6");
    expect(shortModel("claude-haiku-4-5")).toBe("haiku 4.5");
  });
  test("tolerates a trailing suffix on claude names", () => {
    expect(shortModel("claude-opus-4-8-20260101")).toBe("opus 4.8");
  });
  test("passes non-claude names through unchanged", () => {
    expect(shortModel("gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(shortModel("gpt-5.5")).toBe("gpt-5.5");
  });
});

describe("projectLabeler", () => {
  test("strips the common prefix and keeps the divergent tail", () => {
    const label = projectLabeler([
      "-Users-danilo-Progetti-DICE-game1",
      "-Users-danilo-Progetti-DICE-game2",
      "-Users-danilo-Progetti-foo",
    ]);
    expect(label("-Users-danilo-Progetti-DICE-game1")).toBe("DICE/game1");
    expect(label("-Users-danilo-Progetti-foo")).toBe("foo");
  });
  test("a single project shows only its last segment", () => {
    const label = projectLabeler(["-Users-danilo-Progetti-DICE-game1"]);
    expect(label("-Users-danilo-Progetti-DICE-game1")).toBe("game1");
  });
  test("with no common prefix, keeps the whole tail (sans leading dash)", () => {
    const label = projectLabeler(["-a-b", "-c-d"]);
    expect(label("-a-b")).toBe("a/b");
  });
});

describe("aggregateByProject", () => {
  test("sums tokens/cost, unions models, takes latest date, counts sessions per project", () => {
    const rows = aggregateByProject([
      session({
        projectPath: "-proj-a",
        totalTokens: 100,
        totalCost: 5,
        modelsUsed: ["opus"],
        lastActivity: "2026-05-29",
      }),
      session({
        projectPath: "-proj-a",
        totalTokens: 50,
        totalCost: 2,
        modelsUsed: ["opus", "sonnet"],
        lastActivity: "2026-05-30",
      }),
      session({
        projectPath: "-proj-b",
        totalTokens: 10,
        totalCost: 1,
        modelsUsed: ["haiku"],
        lastActivity: "2026-05-28",
      }),
    ]);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.projectPath === "-proj-a");
    expect(a).toEqual({
      projectPath: "-proj-a",
      modelsUsed: ["opus", "sonnet"],
      totalTokens: 150,
      totalCost: 7,
      lastActivity: "2026-05-30",
      sessionCount: 2,
    });
    const b = rows.find((r) => r.projectPath === "-proj-b");
    expect(b?.sessionCount).toBe(1);
  });

  test("empty input yields no rows", () => {
    expect(aggregateByProject([])).toEqual([]);
  });
});

describe("fmtCountdown", () => {
  test("hours and minutes", () => {
    expect(fmtCountdown(2 * 3600_000 + 5 * 60_000)).toBe("2h 5m");
  });
  test("minutes only", () => {
    expect(fmtCountdown(45 * 60_000)).toBe("45m");
  });
  test("seconds under a minute", () => {
    expect(fmtCountdown(30_000)).toBe("30s");
  });
  test("clamps past-due to now", () => {
    expect(fmtCountdown(-5)).toBe("now");
  });
});

describe("fmtPercent", () => {
  test("rounds to a whole percent", () => {
    expect(fmtPercent(49.6)).toBe("50%");
  });
});

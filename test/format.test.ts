import { describe, expect, test } from "bun:test";
import { projectLabeler, shortModel } from "../web/format";

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

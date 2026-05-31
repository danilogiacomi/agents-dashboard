import { describe, expect, test } from "bun:test";
import {
  END,
  START,
  aggregateClaude,
  aggregateCodex,
  claudeProjectDir,
  formatDuration,
  formatTokens,
  mergeStats,
  renderSection,
  replaceSection,
} from "../scripts/usage-self";

describe("formatTokens", () => {
  test("scales to K/M/B", () => {
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(270_936_547)).toBe("270.9M");
    expect(formatTokens(2_500_000_000)).toBe("2.50B");
  });
});

describe("formatDuration", () => {
  test("formats h/m/s", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(150)).toBe("2m");
    expect(formatDuration(3600 + 5 * 60)).toBe("1h 5m");
  });
});

describe("claudeProjectDir", () => {
  test("encodes path separators and dots as dashes", () => {
    expect(claudeProjectDir("/Users/d/Progetti/DICE/ccusage")).toBe(
      "-Users-d-Progetti-DICE-ccusage",
    );
    expect(claudeProjectDir("/a/b.c")).toBe("-a-b-c");
  });
});

describe("aggregateClaude", () => {
  const line = (obj: unknown) => JSON.stringify(obj);
  const transcript = [
    line({ type: "user", timestamp: "2026-05-30T10:00:00.000Z", message: { role: "user" } }),
    line({
      type: "assistant",
      timestamp: "2026-05-30T10:00:30.000Z",
      message: {
        model: "claude-opus-4-8",
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 1000,
        },
        content: [
          { type: "tool_use", name: "Bash" },
          { type: "text", text: "hi" },
        ],
      },
    }),
    line({
      type: "assistant",
      timestamp: "2026-05-30T10:01:00.000Z",
      message: { model: "<synthetic>", usage: { output_tokens: 5 }, content: [] },
    }),
  ].join("\n");

  test("sums tokens, turns, tool calls and excludes synthetic model", () => {
    const { stats, tsMs } = aggregateClaude([transcript]);
    expect(stats.inputTokens).toBe(100);
    expect(stats.outputTokens).toBe(205);
    expect(stats.cacheCreation).toBe(50);
    expect(stats.cacheRead).toBe(1000);
    expect(stats.totalTokens).toBe(1355);
    expect(stats.assistantTurns).toBe(2);
    expect(stats.toolCalls).toBe(1);
    expect(stats.models).toEqual(["claude-opus-4-8"]);
    expect(stats.agents).toEqual(["Claude Code"]);
    expect(tsMs.length).toBe(3);
  });
});

describe("aggregateCodex", () => {
  const rollout = (cwd: string) =>
    [
      JSON.stringify({
        type: "session_meta",
        timestamp: "2026-05-30T09:00:00.000Z",
        payload: { cwd },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp: "2026-05-30T09:05:00.000Z",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 10,
              output_tokens: 20,
              reasoning_output_tokens: 5,
              cached_input_tokens: 300,
              total_tokens: 335,
            },
          },
        },
      }),
    ].join("\n");

  test("includes only sessions whose cwd matches the repo", () => {
    const { stats } = aggregateCodex([rollout("/repo"), rollout("/other")], "/repo");
    expect(stats.inputTokens).toBe(10);
    expect(stats.outputTokens).toBe(25); // output + reasoning
    expect(stats.cacheRead).toBe(300);
    expect(stats.agents).toEqual(["Codex"]);
  });

  test("returns no agent when nothing matches", () => {
    const { stats } = aggregateCodex([rollout("/other")], "/repo");
    expect(stats.agents).toEqual([]);
    expect(stats.totalTokens).toBe(0);
  });
});

describe("mergeStats", () => {
  test("combines tokens, agents, and time spans", () => {
    const claude = aggregateClaude([
      [
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-05-30T10:00:00.000Z",
          message: { model: "claude-opus-4-8", usage: { output_tokens: 100 } },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-05-30T10:02:00.000Z",
          message: { model: "claude-opus-4-8", usage: { output_tokens: 100 } },
        }),
      ].join("\n"),
    ]);
    const merged = mergeStats(claude, aggregateCodex([], "/repo"));
    expect(merged.totalTokens).toBe(claude.stats.totalTokens);
    expect(merged.agents).toEqual(["Claude Code"]);
    expect(merged.activeSeconds).toBe(120); // 2-minute gap counts as active
    expect(merged.firstDate).toBe("2026-05-30");
  });
});

describe("replaceSection", () => {
  test("replaces content between markers", () => {
    const readme = `# Title\n\n${START}\nold\n${END}\n\n## License\n`;
    const out = replaceSection(readme, `${START}\nNEW\n${END}`);
    expect(out).toContain("NEW");
    expect(out).not.toContain("old");
    expect(out).toContain("## License");
  });

  test("inserts before License when markers are absent", () => {
    const readme = "# Title\n\nbody\n\n## License\n\nMIT\n";
    const out = replaceSection(readme, `${START}\nNEW\n${END}`);
    expect(out.indexOf("NEW")).toBeGreaterThan(-1);
    expect(out.indexOf("NEW")).toBeLessThan(out.indexOf("## License"));
  });
});

describe("renderSection", () => {
  test("leads with the total-token headline and is marker-wrapped", () => {
    const section = renderSection({
      totalTokens: 270_936_547,
      inputTokens: 116_314,
      outputTokens: 1_403_306,
      cacheCreation: 6_513_797,
      cacheRead: 262_903_130,
      activeSeconds: 14_700,
      wallSeconds: 74_940,
      assistantTurns: 1008,
      toolCalls: 464,
      models: ["claude-opus-4-8"],
      agents: ["Claude Code"],
      firstDate: "2026-05-30",
      lastDate: "2026-05-31",
    });
    expect(section.startsWith(START)).toBe(true);
    expect(section.trimEnd().endsWith(END)).toBe(true);
    expect(section).toContain("| **Total tokens** | **270.9M** |");
    expect(section).toContain("2026-05-30 → 2026-05-31");
    expect(section).toContain("Claude Code");
  });
});

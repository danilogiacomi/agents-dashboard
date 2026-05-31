# Current Usage Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Current usage" panel that shows the selected agent's current rate-limit consumption (% used + time to reset) using only local data, with Codex showing real values and Claude showing a clearly-labeled historical-peak estimate.

**Architecture:** A pure derivation module (`src/current-usage.ts`) turns raw inputs into a `CurrentUsage` snapshot. Its side-effecting inputs (running `ccusage blocks`, reading Codex rollout logs) are injected as deps so the logic is unit-testable with fixtures — mirroring the existing `handleUsage`/`HandlerDeps` pattern. A new `GET /api/current-usage` route serves the snapshot; the frontend renders bars and ticks reset countdowns client-side, re-fetching every 60s.

**Tech Stack:** Bun, TypeScript, Bun.serve routes, Bun's test runner, vanilla TS frontend, Biome.

---

## File Structure

- `src/types.ts` (modify) — add `UsageWindow`, `CurrentUsage`, and Codex rate-limit shapes.
- `src/current-usage.ts` (create) — pure `deriveClaudeUsage`, `deriveCodexUsage`, `labelForWindow`, and the `getCurrentUsage(tool, deps)` orchestrator.
- `src/codex-logs.ts` (create) — `readLatestCodexRateLimits()`: filesystem reader for the newest rollout log's last `rate_limits` snapshot (isolated so the derivation stays pure).
- `src/ccusage.ts` (modify) — add `runCcusageBlocks(tool, opts)` spawning `ccusage blocks --json`.
- `src/server.ts` (modify) — wire `GET /api/current-usage`.
- `web/format.ts` (modify) — add `fmtCountdown(ms)` and `fmtPercent(p)`.
- `web/index.html` (modify) — add the `#usagePanel` markup below the `.grid` and its CSS.
- `web/main.ts` (modify) — fetch, render, 60s poll, 1s countdown ticker.
- `test/current-usage.test.ts` (create) — derivation tests.
- `test/format.test.ts` (modify) — countdown/percent tests.
- `test/fixtures/sample.ts` (modify) — `claudeBlocksRaw`, `codexRateLimitsSample`.

---

## Task 1: Types

**Files:**
- Modify: `src/types.ts` (append after the existing `DashboardData` interface)

- [ ] **Step 1: Add the type definitions**

Append to `src/types.ts`:

```ts
// --- current usage (rate-limit snapshot) ---
export interface UsageWindow {
  label: string; // "5-hour session", "Weekly", or "{n}-hour"/"{n}-day"
  usedPercent: number; // 0–100
  resetsAt: string; // ISO 8601, absolute
  basis: "exact" | "estimate";
  detail?: string; // e.g. "21.5M tokens"
}
export interface CurrentUsage {
  tool: string;
  available: boolean;
  windows: UsageWindow[];
  note?: string;
}

// Codex rollout `rate_limits` shape (subset we consume).
export interface CodexRateWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number; // unix seconds
}
export interface CodexRateLimits {
  primary: CodexRateWindow | null;
  secondary: CodexRateWindow | null;
}
```

- [ ] **Step 2: Verify types compile**

Run: `bun run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add CurrentUsage and Codex rate-limit types"
```

---

## Task 2: Window label helper

**Files:**
- Create: `src/current-usage.ts`
- Test: `test/current-usage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/current-usage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/current-usage.test.ts`
Expected: FAIL ("Export named 'labelForWindow' not found" / module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/current-usage.ts`:

```ts
export function labelForWindow(minutes: number): string {
  if (minutes === 300) return "5-hour session";
  if (minutes === 10080) return "Weekly";
  if (minutes % 1440 === 0) return `${minutes / 1440}-day`;
  return `${Math.round(minutes / 60)}-hour`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/current-usage.test.ts`
Expected: PASS (4 pass).

- [ ] **Step 5: Commit**

```bash
git add src/current-usage.ts test/current-usage.test.ts
git commit -m "feat: add labelForWindow helper"
```

---

## Task 3: Codex usage derivation

**Files:**
- Modify: `src/current-usage.ts`
- Modify: `test/fixtures/sample.ts`
- Test: `test/current-usage.test.ts`

- [ ] **Step 1: Add the fixture**

Append to `test/fixtures/sample.ts`:

```ts
import type { CodexRateLimits } from "../../src/types";

export const codexRateLimitsSample: CodexRateLimits = {
  // 5-hour window, 62% used, resets at 2026-05-31T14:00:00Z (1780754400)
  secondary: { used_percent: 62, window_minutes: 300, resets_at: 1780754400 },
  // weekly window, 31% used, resets at a later time (1780738238)
  primary: { used_percent: 31, window_minutes: 10080, resets_at: 1780738238 },
};
```

> If `test/fixtures/sample.ts` has no `import type` lines yet, add the import at the top instead of inline.

- [ ] **Step 2: Write the failing test**

Append to `test/current-usage.test.ts`:

```ts
import { deriveCodexUsage } from "../src/current-usage";
import { codexRateLimitsSample } from "./fixtures/sample";

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/current-usage.test.ts`
Expected: FAIL ("Export named 'deriveCodexUsage' not found").

- [ ] **Step 4: Write minimal implementation**

Add to `src/current-usage.ts` (and add the import at the top):

```ts
import type { CodexRateLimits, CodexRateWindow, CurrentUsage, UsageWindow } from "./types";

function codexWindow(w: CodexRateWindow): UsageWindow {
  return {
    label: labelForWindow(w.window_minutes),
    usedPercent: Math.max(0, Math.min(100, w.used_percent)),
    resetsAt: new Date(w.resets_at * 1000).toISOString(),
    basis: "exact",
  };
}

export function deriveCodexUsage(rl: CodexRateLimits | null): CurrentUsage {
  if (!rl || (!rl.primary && !rl.secondary)) {
    return { tool: "codex", available: false, windows: [], note: "no rate-limit data in the latest Codex session log" };
  }
  const windows = [rl.secondary, rl.primary].filter((w): w is CodexRateWindow => w != null).map(codexWindow);
  return { tool: "codex", available: true, windows };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/current-usage.test.ts`
Expected: PASS (all deriveCodexUsage + labelForWindow tests).

- [ ] **Step 6: Commit**

```bash
git add src/current-usage.ts test/current-usage.test.ts test/fixtures/sample.ts
git commit -m "feat: derive Codex current usage from rate_limits"
```

---

## Task 4: Claude usage derivation

**Files:**
- Modify: `src/current-usage.ts`
- Modify: `test/fixtures/sample.ts`
- Test: `test/current-usage.test.ts`

- [ ] **Step 1: Add the fixture**

Append to `test/fixtures/sample.ts`:

```ts
// `ccusage blocks --json`: one historical block (bigger) + one active block.
export const claudeBlocksRaw = {
  blocks: [
    {
      id: "2026-05-30T08:00:00.000Z",
      isActive: false,
      isGap: false,
      endTime: "2026-05-30T13:00:00.000Z",
      totalTokens: 40000000,
    },
    {
      id: "2026-05-31T08:00:00.000Z",
      isActive: true,
      isGap: false,
      endTime: "2026-05-31T13:00:00.000Z",
      totalTokens: 20000000,
    },
  ],
};

export const claudeBlocksNoActive = {
  blocks: [
    { id: "g", isActive: false, isGap: true, endTime: "2026-05-30T13:00:00.000Z", totalTokens: 0 },
  ],
};
```

- [ ] **Step 2: Write the failing test**

Append to `test/current-usage.test.ts`:

```ts
import { deriveClaudeUsage } from "../src/current-usage";
import { claudeBlocksNoActive, claudeBlocksRaw } from "./fixtures/sample";

describe("deriveClaudeUsage", () => {
  test("estimates percent against the historical-peak block", () => {
    const u = deriveClaudeUsage(claudeBlocksRaw);
    expect(u.available).toBe(true);
    expect(u.windows).toHaveLength(1);
    const w = u.windows[0];
    expect(w?.label).toBe("5-hour session");
    expect(w?.basis).toBe("estimate"); // never claims to be the real plan limit
    expect(w?.usedPercent).toBe(50); // 20M / 40M
    expect(w?.resetsAt).toBe("2026-05-31T13:00:00.000Z");
    expect(u.note).toBeTruthy(); // explains the estimate basis
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/current-usage.test.ts`
Expected: FAIL ("Export named 'deriveClaudeUsage' not found").

- [ ] **Step 4: Write minimal implementation**

Add to `src/current-usage.ts`:

```ts
interface ClaudeBlock {
  isActive?: boolean;
  isGap?: boolean;
  endTime?: string;
  totalTokens?: number;
}

const CLAUDE_ESTIMATE_NOTE =
  "Estimate: % is relative to your busiest 5-hour block, not a real plan limit (Claude does not expose quota locally).";

function humanTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M tokens`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K tokens`;
  return `${n} tokens`;
}

export function deriveClaudeUsage(raw: unknown): CurrentUsage {
  const blocks: ClaudeBlock[] = Array.isArray((raw as { blocks?: unknown })?.blocks)
    ? ((raw as { blocks: ClaudeBlock[] }).blocks)
    : [];
  const active = blocks.find((b) => b.isActive && !b.isGap);
  if (!active || !active.endTime) {
    return { tool: "claude", available: true, windows: [], note: "no active session in the last 5 hours" };
  }
  const peak = Math.max(0, ...blocks.filter((b) => !b.isGap).map((b) => b.totalTokens ?? 0));
  const used = active.totalTokens ?? 0;
  const usedPercent = peak > 0 ? Math.max(0, Math.min(100, (used / peak) * 100)) : 0;
  return {
    tool: "claude",
    available: true,
    windows: [
      {
        label: "5-hour session",
        usedPercent,
        resetsAt: new Date(active.endTime).toISOString(),
        basis: "estimate",
        detail: humanTokens(used),
      },
    ],
    note: CLAUDE_ESTIMATE_NOTE,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/current-usage.test.ts`
Expected: PASS (all derivation tests).

- [ ] **Step 6: Commit**

```bash
git add src/current-usage.ts test/current-usage.test.ts test/fixtures/sample.ts
git commit -m "feat: derive Claude current usage as historical-peak estimate"
```

---

## Task 5: ccusage blocks runner

**Files:**
- Modify: `src/ccusage.ts`
- Test: `test/ccusage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/ccusage.test.ts` (inside the file; reuse its existing imports, adding `buildBlocksArgs`):

```ts
import { buildBlocksArgs } from "../src/ccusage";

describe("buildBlocksArgs", () => {
  test("requests JSON blocks for the given tool", () => {
    expect(buildBlocksArgs("claude")).toEqual(["blocks", "--json"]);
  });
});
```

> If `test/ccusage.test.ts` already imports from `../src/ccusage`, add `buildBlocksArgs` to that existing import and drop the extra import line.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/ccusage.test.ts`
Expected: FAIL ("Export named 'buildBlocksArgs' not found").

- [ ] **Step 3: Write minimal implementation**

In `src/ccusage.ts`, add (the `blocks` subcommand is Claude-only in ccusage, so `tool` is currently unused but kept for forward-compat):

```ts
export function buildBlocksArgs(_tool: string): string[] {
  return ["blocks", "--json"];
}

export async function runCcusageBlocks(tool: string, opts: RunOptions = {}): Promise<unknown> {
  const binParts = (opts.bin ?? process.env.CCUSAGE_BIN ?? "bunx ccusage").split(" ");
  const head = binParts[0];
  if (!head) throw new CcusageError("CCUSAGE_BIN is empty");
  const cmd = [head, ...binParts.slice(1), ...buildBlocksArgs(tool)];

  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, opts.timeoutMs ?? 60_000);

  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (timedOut) throw new CcusageError("ccusage blocks timed out", stderr);
    if (code !== 0) throw new CcusageError(`ccusage blocks exited with code ${code}`, stderr);
    try {
      return JSON.parse(stdout);
    } catch {
      throw new CcusageError("failed to parse ccusage blocks JSON output", stdout.slice(0, 500));
    }
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/ccusage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ccusage.ts test/ccusage.test.ts
git commit -m "feat: add runCcusageBlocks for the claude blocks command"
```

---

## Task 6: Codex log reader

**Files:**
- Create: `src/codex-logs.ts`

> This task is filesystem I/O with no pure logic to unit-test (it reads whatever is on the
> machine). It is exercised end-to-end via the route in Task 7. Keep it tiny and dependency-free.

- [ ] **Step 1: Write the implementation**

Create `src/codex-logs.ts`:

```ts
import { homedir } from "node:os";
import { join } from "node:path";
import type { CodexRateLimits } from "./types";

// Find the most recently modified rollout-*.jsonl under CODEX_HOME/sessions and
// return the last rate_limits snapshot it contains, or null if none is found.
export async function readLatestCodexRateLimits(): Promise<CodexRateLimits | null> {
  const root = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions");
  const glob = new Bun.Glob("**/rollout-*.jsonl");

  let newest: { path: string; mtime: number } | null = null;
  try {
    for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
      const path = join(root, rel);
      const mtime = (await Bun.file(path).stat()).mtimeMs;
      if (!newest || mtime > newest.mtime) newest = { path, mtime };
    }
  } catch {
    return null; // no ~/.codex/sessions directory
  }
  if (!newest) return null;

  const text = await Bun.file(newest.path).text();
  let found: CodexRateLimits | null = null;
  for (const line of text.split("\n")) {
    if (!line.includes("rate_limits")) continue;
    try {
      const obj = JSON.parse(line) as { payload?: { info?: { rate_limits?: CodexRateLimits } } };
      const rl = obj.payload?.info?.rate_limits;
      if (rl) found = rl; // keep the last one
    } catch {
      // ignore malformed lines
    }
  }
  return found;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/codex-logs.ts
git commit -m "feat: read latest Codex rate_limits from rollout logs"
```

---

## Task 7: Orchestrator, handler, and route

**Files:**
- Modify: `src/current-usage.ts`
- Create: `src/current-usage-handler.ts`
- Modify: `src/server.ts`
- Test: `test/current-usage.test.ts`

- [ ] **Step 1: Write the failing test for the orchestrator + handler**

Append to `test/current-usage.test.ts`:

```ts
import { type CurrentUsageDeps, getCurrentUsage } from "../src/current-usage";
import { handleCurrentUsage } from "../src/current-usage-handler";

function cuDeps(over: Partial<CurrentUsageDeps> = {}): CurrentUsageDeps {
  return {
    runBlocks: async () => claudeBlocksRaw,
    readCodexRateLimits: async () => codexRateLimitsSample,
    ...over,
  };
}

describe("getCurrentUsage", () => {
  test("claude routes through blocks", async () => {
    const u = await getCurrentUsage("claude", cuDeps());
    expect(u.tool).toBe("claude");
    expect(u.windows[0]?.basis).toBe("estimate");
  });
  test("codex routes through rate limits", async () => {
    const u = await getCurrentUsage("codex", cuDeps());
    expect(u.tool).toBe("codex");
    expect(u.windows[0]?.basis).toBe("exact");
  });
  test("other tools report unavailable", async () => {
    const u = await getCurrentUsage("gemini", cuDeps());
    expect(u.available).toBe(false);
    expect(u.note).toBeTruthy();
  });
});

describe("handleCurrentUsage", () => {
  test("returns 200 with the snapshot", async () => {
    const res = await handleCurrentUsage(
      new Request("http://localhost/api/current-usage?tool=codex"),
      cuDeps(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tool).toBe("codex");
  });
  test("rejects an unsupported tool with 400", async () => {
    const res = await handleCurrentUsage(
      new Request("http://localhost/api/current-usage?tool=bogus"),
      cuDeps(),
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/current-usage.test.ts`
Expected: FAIL ("Export named 'getCurrentUsage' not found" / module `current-usage-handler` not found).

- [ ] **Step 3: Implement the orchestrator**

Add to `src/current-usage.ts`:

```ts
export interface CurrentUsageDeps {
  runBlocks: (tool: string) => Promise<unknown>;
  readCodexRateLimits: () => Promise<CodexRateLimits | null>;
}

export async function getCurrentUsage(tool: string, deps: CurrentUsageDeps): Promise<CurrentUsage> {
  if (tool === "claude") return deriveClaudeUsage(await deps.runBlocks("claude"));
  if (tool === "codex") return deriveCodexUsage(await deps.readCodexRateLimits());
  return { tool, available: false, windows: [], note: "current usage not available for this agent yet" };
}
```

- [ ] **Step 4: Implement the handler**

Create `src/current-usage-handler.ts`:

```ts
import { CcusageError } from "./ccusage";
import { type CurrentUsageDeps, getCurrentUsage } from "./current-usage";
import { SUPPORTED_TOOLS } from "./types";

export async function handleCurrentUsage(req: Request, deps: CurrentUsageDeps): Promise<Response> {
  const tool = new URL(req.url).searchParams.get("tool") ?? "";
  if (!(SUPPORTED_TOOLS as readonly string[]).includes(tool)) {
    return json({ error: `unsupported tool: ${tool || "(none)"}` }, 400);
  }
  try {
    return json(await getCurrentUsage(tool, deps), 200);
  } catch (e) {
    if (e instanceof CcusageError) return json({ error: e.message, detail: e.stderr }, 502);
    return json({ error: "internal error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/current-usage.test.ts`
Expected: PASS (all current-usage tests).

- [ ] **Step 6: Wire the route**

In `src/server.ts`, add the imports and route. The file becomes:

```ts
#!/usr/bin/env bun
import index from "../web/index.html";
import { runCcusage, runCcusageBlocks } from "./ccusage";
import { readLatestCodexRateLimits } from "./codex-logs";
import { handleCurrentUsage } from "./current-usage-handler";
import { handleUsage } from "./usage-handler";

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/api/usage": {
      GET: (req) => handleUsage(req, { run: runCcusage, now: () => new Date() }),
    },
    "/api/current-usage": {
      GET: (req) =>
        handleCurrentUsage(req, {
          runBlocks: (tool) => runCcusageBlocks(tool),
          readCodexRateLimits: readLatestCodexRateLimits,
        }),
    },
  },
});

console.log(`Agents Dashboard running at http://localhost:${server.port}`);
```

- [ ] **Step 7: Verify everything compiles and passes**

Run: `bun run typecheck && bun test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/current-usage.ts src/current-usage-handler.ts src/server.ts test/current-usage.test.ts
git commit -m "feat: serve /api/current-usage"
```

---

## Task 8: Frontend formatters

**Files:**
- Modify: `web/format.ts`
- Test: `test/format.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/format.test.ts` (add `fmtCountdown, fmtPercent` to the existing `../web/format` import):

```ts
import { fmtCountdown, fmtPercent } from "../web/format";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/format.test.ts`
Expected: FAIL ("Export named 'fmtCountdown' not found").

- [ ] **Step 3: Write minimal implementation**

Append to `web/format.ts`:

```ts
// Humanize a remaining-milliseconds duration as a compact countdown.
export function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
}

export function fmtPercent(p: number): string {
  return `${Math.round(p)}%`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/format.ts test/format.test.ts
git commit -m "feat: add countdown/percent formatters"
```

---

## Task 9: Frontend panel (markup + CSS)

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Add the panel markup**

In `web/index.html`, insert immediately after the `.grid` closing `</div>` (the line before `<div class="panel" style="margin-bottom:10px">` that holds Sessions):

```html
      <section class="panel" id="usagePanel" style="margin-bottom:10px" hidden>
        <h3>Current usage</h3>
        <div id="usageBody"></div>
      </section>
```

- [ ] **Step 2: Add the CSS**

In `web/index.html`, add these rules just before the closing `</style>`:

```css
      #usagePanel[hidden] { display:none; }
      .usage-win { margin:12px 0; }
      .usage-win:first-child { margin-top:4px; }
      .usage-head { display:flex; justify-content:space-between; align-items:baseline;
        font-size:12px; color:var(--muted); margin-bottom:5px; }
      .usage-head .pct { color:var(--fg); font-variant-numeric:tabular-nums; }
      .usage-bar { height:8px; background:#11141a; border:1px solid var(--line);
        border-radius:999px; overflow:hidden; }
      .usage-bar > span { display:block; height:100%; background:#4a86e8; }
      .usage-reset { font-size:11px; color:var(--muted); margin-top:4px; }
      .usage-note { color:var(--muted); font-size:11px; margin-top:8px; }
      .usage-est { font-size:10px; text-transform:uppercase; letter-spacing:.04em;
        color:var(--muted); border:1px solid var(--line); border-radius:4px;
        padding:0 4px; margin-left:6px; }
```

- [ ] **Step 3: Verify the dev server still renders**

Run: `bun run start` in the background, then `curl -s localhost:3000 | grep usagePanel`
Expected: the `usagePanel` markup is present. Stop the server afterward.

- [ ] **Step 4: Commit**

```bash
git add web/index.html
git commit -m "feat: add current-usage panel markup and styles"
```

---

## Task 10: Frontend rendering, polling, and countdown

**Files:**
- Modify: `web/main.ts`

- [ ] **Step 1: Add element refs and the import**

In `web/main.ts`, add `CurrentUsage` and `UsageWindow` to the `../src/types` import, and `fmtCountdown, fmtPercent` to the `./format` import. Add element refs near the other `$()` calls (after `mainEl`):

```ts
const usagePanel = $<HTMLElement>("usagePanel");
const usageBody = $<HTMLDivElement>("usageBody");
```

- [ ] **Step 2: Add the render + fetch + ticker logic**

Add this block near the other render functions in `web/main.ts`:

```ts
let usageWindows: UsageWindow[] = [];

function renderCurrentUsage(u: CurrentUsage): void {
  usageWindows = u.windows;
  usagePanel.hidden = false;
  const rows = u.windows
    .map((w, i) => {
      const est = w.basis === "estimate" ? `<span class="usage-est">estimate</span>` : "";
      const detail = w.detail ? ` · ${w.detail}` : "";
      const pct = Math.max(0, Math.min(100, w.usedPercent));
      return `
      <div class="usage-win">
        <div class="usage-head"><span>${w.label}${est}${detail}</span>
          <span class="pct">${fmtPercent(w.usedPercent)}</span></div>
        <div class="usage-bar"><span style="width:${pct}%"></span></div>
        <div class="usage-reset" data-reset="${i}">resets in …</div>
      </div>`;
    })
    .join("");
  // No windows (unavailable agent, or Claude with no active session) → show the note only.
  const note = u.note ? `<p class="usage-note">${u.note}</p>` : "";
  usageBody.innerHTML = u.windows.length ? rows + note : note || `<p class="usage-note">Current usage not available.</p>`;
  tickCountdowns();
}

function tickCountdowns(): void {
  const nowMs = Date.now();
  for (const el of usageBody.querySelectorAll<HTMLElement>("[data-reset]")) {
    const w = usageWindows[Number(el.dataset.reset)];
    if (w) el.textContent = `resets in ${fmtCountdown(new Date(w.resetsAt).getTime() - nowMs)}`;
  }
}

async function loadCurrentUsage(): Promise<void> {
  try {
    const res = await fetch(`/api/current-usage?tool=${encodeURIComponent(toolSel.value)}`);
    if (!res.ok) {
      usagePanel.hidden = true;
      return;
    }
    renderCurrentUsage(await res.json());
  } catch {
    usagePanel.hidden = true;
  }
}

setInterval(tickCountdowns, 1000);
setInterval(() => void loadCurrentUsage(), 60_000);
```

> `Date.now()` is a browser API here (this is frontend code), not the workflow-script restriction — it is fine to use.

- [ ] **Step 3: Trigger the fetch on load and tool change**

In `web/main.ts`, find the `run()` function and call `loadCurrentUsage()` at its start (so it refreshes whenever the dashboard reloads). Also confirm the existing `toolSel.addEventListener("change", () => void run())` will therefore refresh usage on tool change — it will, since `run()` now calls `loadCurrentUsage()`. Add inside `run()`, as its first statement:

```ts
  void loadCurrentUsage();
```

- [ ] **Step 4: Verify build + types**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Run: `bun run start` (background). Open `http://localhost:3000`, select **codex** in the dropdown — the "Current usage" panel shows real % bars with a live "resets in …" countdown that decrements each second. Select **claude** — one "5-hour session" bar with an `estimate` tag and the estimate note (or "no active session" if idle). Select **gemini** — the "not available" note. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add web/main.ts
git commit -m "feat: render current-usage panel with live countdown and 60s poll"
```

---

## Task 11: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite**

Run: `bun test && bun run typecheck && bun run lint`
Expected: all tests pass, no type errors, lint clean. If lint reports formatting, run `bun run format` and re-commit.

- [ ] **Step 2: Confirm acceptance criteria from the spec**

Re-read `specs/001-current-usage-box.md` "Acceptance criteria" and tick each box against observed behavior (codex exact windows, claude estimate window, unavailable note, panel placement/poll/countdown, honesty labels, tests green, lint clean).

- [ ] **Step 3: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: formatting and final verification for current-usage box"
```

---

## Notes

- **DRY:** `runCcusageBlocks` intentionally mirrors `runCcusage`'s spawn/timeout/parse logic; if a third spawn variant appears later, extract a shared `spawnCcusage(args, opts)` helper then (YAGNI for now).
- **Honesty invariant:** only `deriveClaudeUsage` ever sets `basis: "estimate"`; Codex windows are always `exact`. The UI renders the `estimate` tag and note off `basis`/`note`, so the distinction is never lost.
- **Forward-compat:** if Anthropic ships an official usage endpoint, swap the `runBlocks` branch in `getCurrentUsage` for a real fetch and change `basis` to `exact` — the API/UI shapes don't change.

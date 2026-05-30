# ccusage-dash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web app that lets a user pick a coding-agent tool and a date range in the browser, runs the external `ccusage` CLI, and renders an aggregated usage dashboard.

**Architecture:** A Bun (`Bun.serve`) server serves a single HTML page (top control bar + dashboard) and a `GET /api/usage` endpoint. On request the endpoint resolves the date range, spawns `bunx ccusage <tool> daily --json` and `<tool> session --json`, aggregates both into one DTO, and returns it. The vanilla-TypeScript frontend renders KPI cards, three Chart.js charts, and a sessions table. Data is fetched on demand, no cache.

**Tech Stack:** Bun 1.3 + TypeScript (strict), `Bun.serve` fullstack HTML routes (auto-bundles the frontend TS), Chart.js, Biome (lint/format), `bun test`.

**Source spec:** `docs/superpowers/specs/2026-05-30-ccusage-dash-design.md`

---

## File Structure

```
src/
  types.ts          ccusage --json shapes + dashboard DTO + SUPPORTED_TOOLS
  ranges.ts         pure: TemplateId + now -> {since, until}
  aggregate.ts      pure: daily + session JSON -> DashboardData
  ccusage.ts        buildCcusageArgs (pure) + runCcusage (Bun.spawn) + CcusageError
  usage-handler.ts  request -> Response; validates, resolves range, runs, aggregates
  server.ts         Bun.serve wiring (routes + default deps)
web/
  index.html        top control bar, KPI row, chart grid, sessions table (layout A)
  main.ts           controls wiring, fetch, Chart.js render
test/
  ranges.test.ts
  aggregate.test.ts
  ccusage.test.ts
  usage-handler.test.ts
  fixtures/sample.ts  shared CcusageDailyReport + CcusageSessionReport fixtures
docs/
  ARCHITECTURE.md
  adr/0001-wrap-ccusage-cli.md
  adr/0002-bun-vanilla-chartjs.md
  adr/0003-on-demand-no-cache.md
README.md
package.json · tsconfig.json · biome.json
```

Testable seams: `ranges.ts`, `aggregate.ts`, and `ccusage.buildCcusageArgs` are pure. `usage-handler.ts` takes injected deps (`run`, `now`) so it is tested with a fake runner — no real process spawn in tests. `runCcusage` and the frontend are verified by a manual smoke run.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`
- Create dirs: `src/`, `web/`, `test/fixtures/`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ccusage-dash",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/server.ts",
    "start": "NODE_ENV=production bun run src/server.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "chart.js": "^4.4.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.6.0",
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "preserve"
  },
  "include": ["src", "web", "test"]
}
```

- [ ] **Step 3: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["web/dist", ".agent-ready", ".superpowers"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "organizeImports": { "enabled": true }
}
```

- [ ] **Step 4: Install dependencies**

Run: `bun install`
Expected: creates `bun.lock` and `node_modules/`; exits 0.

- [ ] **Step 5: Add build artifacts to `.gitignore`**

Append to the existing `.gitignore` (Node section already lists `node_modules/`; add the Bun lock note and dist):

```
# Bun
web/dist/
```
(Do NOT ignore `bun.lock` — it is the committed lockfile for reproducible installs.)

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json biome.json bun.lock .gitignore
git commit -m "chore: scaffold Bun + TS project with Biome"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
// --- ccusage --json shapes (subset we consume) ---
export interface CcusageModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface CcusageSession {
  sessionId: string;
  projectPath: string;
  lastActivity: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: CcusageModelBreakdown[];
}
export interface CcusageSessionReport {
  sessions: CcusageSession[];
}

export interface CcusageDailyEntry {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: CcusageModelBreakdown[];
}
export interface CcusageDailyReport {
  daily: CcusageDailyEntry[];
}

// --- domain ---
export const SUPPORTED_TOOLS = [
  "claude",
  "codex",
  "opencode",
  "gemini",
  "copilot",
  "amp",
  "droid",
  "goose",
] as const;
export type Tool = (typeof SUPPORTED_TOOLS)[number];

export type TemplateId =
  | "today"
  | "last-7-days"
  | "this-month"
  | "last-month"
  | "last-30-days"
  | "all-time"
  | "custom";

export interface DateRange {
  since?: string;
  until?: string;
}

export interface RangeMeta {
  tool: string;
  template: TemplateId;
  since?: string;
  until?: string;
}

export interface Kpis {
  totalCost: number;
  totalTokens: number;
  sessionCount: number;
  activeDays: number;
}

export interface DailyPoint {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export interface ModelAgg {
  model: string;
  cost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface TokenSplit {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}

export interface SessionRow {
  sessionId: string;
  projectPath: string;
  modelsUsed: string[];
  totalTokens: number;
  totalCost: number;
  lastActivity: string;
}

export interface DashboardData {
  range: RangeMeta;
  kpis: Kpis;
  daily: DailyPoint[];
  byModel: ModelAgg[];
  tokenSplit: TokenSplit;
  sessions: SessionRow[];
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: exits 0 (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared ccusage + dashboard types"
```

---

## Task 3: Date-range resolution (`ranges.ts`)

**Files:**
- Create: `src/ranges.ts`
- Test: `test/ranges.test.ts`

- [ ] **Step 1: Write the failing test**

`test/ranges.test.ts`:
```ts
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
    expect(() => resolveRange("custom", NOW, { since: "01/01/2026", until: "2026-02-01" })).toThrow();
  });
  test("custom rejects since after until", () => {
    expect(() => resolveRange("custom", NOW, { since: "2026-03-01", until: "2026-02-01" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/ranges.test.ts`
Expected: FAIL — cannot find module `../src/ranges`.

- [ ] **Step 3: Write minimal implementation**

`src/ranges.ts`:
```ts
import type { DateRange, TemplateId } from "./types";

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(
  template: TemplateId,
  now: Date,
  custom?: { since?: string; until?: string },
): DateRange {
  switch (template) {
    case "today": {
      const t = fmt(now);
      return { since: t, until: t };
    }
    case "last-7-days": {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      return { since: fmt(s), until: fmt(now) };
    }
    case "last-30-days": {
      const s = new Date(now);
      s.setDate(now.getDate() - 29);
      return { since: fmt(s), until: fmt(now) };
    }
    case "this-month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: fmt(s), until: fmt(now) };
    }
    case "last-month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
      return { since: fmt(s), until: fmt(e) };
    }
    case "all-time":
      return {};
    case "custom": {
      if (!custom?.since || !custom?.until) {
        throw new RangeError("custom range requires both since and until");
      }
      if (!ISO_RE.test(custom.since) || !ISO_RE.test(custom.until)) {
        throw new RangeError("dates must be in YYYY-MM-DD format");
      }
      if (custom.since > custom.until) {
        throw new RangeError("since must be on or before until");
      }
      return { since: custom.since, until: custom.until };
    }
    default:
      throw new RangeError(`unknown template: ${template as string}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/ranges.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ranges.ts test/ranges.test.ts
git commit -m "feat: add date-range template resolution"
```

---

## Task 4: Aggregation (`aggregate.ts`)

**Files:**
- Create: `src/aggregate.ts`, `test/fixtures/sample.ts`
- Test: `test/aggregate.test.ts`

- [ ] **Step 1: Write shared fixtures**

`test/fixtures/sample.ts`:
```ts
import type { CcusageDailyReport, CcusageSessionReport } from "../../src/types";

export const sampleSession: CcusageSessionReport = {
  sessions: [
    {
      sessionId: "s1",
      projectPath: "-proj-a",
      lastActivity: "2026-05-29",
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationTokens: 300,
      cacheReadTokens: 400,
      totalTokens: 1000,
      totalCost: 5,
      modelsUsed: ["claude-opus-4-8"],
      modelBreakdowns: [
        {
          modelName: "claude-opus-4-8",
          inputTokens: 100,
          outputTokens: 200,
          cacheCreationTokens: 300,
          cacheReadTokens: 400,
          cost: 5,
        },
      ],
    },
    {
      sessionId: "s2",
      projectPath: "-proj-b",
      lastActivity: "2026-05-30",
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 30,
      cacheReadTokens: 40,
      totalTokens: 100,
      totalCost: 2,
      modelsUsed: ["claude-opus-4-8", "claude-sonnet-4-6"],
      modelBreakdowns: [
        {
          modelName: "claude-opus-4-8",
          inputTokens: 6,
          outputTokens: 12,
          cacheCreationTokens: 18,
          cacheReadTokens: 24,
          cost: 1.5,
        },
        {
          modelName: "claude-sonnet-4-6",
          inputTokens: 4,
          outputTokens: 8,
          cacheCreationTokens: 12,
          cacheReadTokens: 16,
          cost: 0.5,
        },
      ],
    },
  ],
};

export const sampleDaily: CcusageDailyReport = {
  daily: [
    {
      date: "2026-05-29",
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationTokens: 300,
      cacheReadTokens: 400,
      totalTokens: 1000,
      totalCost: 5,
      modelsUsed: ["claude-opus-4-8"],
      modelBreakdowns: [],
    },
    {
      date: "2026-05-30",
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 30,
      cacheReadTokens: 40,
      totalTokens: 100,
      totalCost: 2,
      modelsUsed: ["claude-opus-4-8", "claude-sonnet-4-6"],
      modelBreakdowns: [],
    },
  ],
};

export const emptySession: CcusageSessionReport = { sessions: [] };
export const emptyDaily: CcusageDailyReport = { daily: [] };
```

- [ ] **Step 2: Write the failing test**

`test/aggregate.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { aggregate } from "../src/aggregate";
import { emptyDaily, emptySession, sampleDaily, sampleSession } from "./fixtures/sample";
import type { RangeMeta } from "../src/types";

const meta: RangeMeta = { tool: "claude", template: "last-7-days", since: "2026-05-24", until: "2026-05-30" };

describe("aggregate", () => {
  const data = aggregate(sampleDaily, sampleSession, meta);

  test("passes range meta through", () => {
    expect(data.range).toEqual(meta);
  });
  test("computes KPIs", () => {
    expect(data.kpis).toEqual({ totalCost: 7, totalTokens: 1100, sessionCount: 2, activeDays: 2 });
  });
  test("builds daily points in order", () => {
    expect(data.daily.map((d) => d.date)).toEqual(["2026-05-29", "2026-05-30"]);
    expect(data.daily[0]?.cost).toBe(5);
  });
  test("aggregates by model, sorted by cost desc", () => {
    expect(data.byModel.map((m) => m.model)).toEqual(["claude-opus-4-8", "claude-sonnet-4-6"]);
    expect(data.byModel[0]?.cost).toBe(6.5); // 5 + 1.5
    expect(data.byModel[1]?.cost).toBe(0.5);
  });
  test("sums token split across sessions", () => {
    expect(data.tokenSplit).toEqual({ input: 110, output: 220, cacheCreate: 330, cacheRead: 440 });
  });
  test("maps sessions to rows", () => {
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0]?.projectPath).toBe("-proj-a");
  });

  test("empty reports yield zeroed dashboard", () => {
    const empty = aggregate(emptyDaily, emptySession, meta);
    expect(empty.kpis).toEqual({ totalCost: 0, totalTokens: 0, sessionCount: 0, activeDays: 0 });
    expect(empty.byModel).toEqual([]);
    expect(empty.sessions).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/aggregate.test.ts`
Expected: FAIL — cannot find module `../src/aggregate`.

- [ ] **Step 4: Write minimal implementation**

`src/aggregate.ts`:
```ts
import type {
  CcusageDailyReport,
  CcusageSessionReport,
  DashboardData,
  ModelAgg,
  RangeMeta,
} from "./types";

export function aggregate(
  daily: CcusageDailyReport,
  session: CcusageSessionReport,
  meta: RangeMeta,
): DashboardData {
  const dailyPoints = daily.daily.map((d) => ({
    date: d.date,
    cost: d.totalCost,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    cacheCreationTokens: d.cacheCreationTokens,
    cacheReadTokens: d.cacheReadTokens,
    totalTokens: d.totalTokens,
  }));

  const sessions = session.sessions.map((s) => ({
    sessionId: s.sessionId,
    projectPath: s.projectPath,
    modelsUsed: s.modelsUsed,
    totalTokens: s.totalTokens,
    totalCost: s.totalCost,
    lastActivity: s.lastActivity,
  }));

  const modelMap = new Map<string, ModelAgg>();
  for (const s of session.sessions) {
    for (const b of s.modelBreakdowns) {
      const m = modelMap.get(b.modelName) ?? {
        model: b.modelName,
        cost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };
      m.cost += b.cost;
      m.inputTokens += b.inputTokens;
      m.outputTokens += b.outputTokens;
      m.cacheCreationTokens += b.cacheCreationTokens;
      m.cacheReadTokens += b.cacheReadTokens;
      m.totalTokens +=
        b.inputTokens + b.outputTokens + b.cacheCreationTokens + b.cacheReadTokens;
      modelMap.set(b.modelName, m);
    }
  }
  const byModel = [...modelMap.values()].sort((a, b) => b.cost - a.cost);

  const tokenSplit = session.sessions.reduce(
    (acc, s) => {
      acc.input += s.inputTokens;
      acc.output += s.outputTokens;
      acc.cacheCreate += s.cacheCreationTokens;
      acc.cacheRead += s.cacheReadTokens;
      return acc;
    },
    { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
  );

  const totalCost = sessions.reduce((a, s) => a + s.totalCost, 0);
  const totalTokens = sessions.reduce((a, s) => a + s.totalTokens, 0);
  const activeDays = dailyPoints.filter((d) => d.totalTokens > 0).length;

  return {
    range: meta,
    kpis: { totalCost, totalTokens, sessionCount: sessions.length, activeDays },
    daily: dailyPoints,
    byModel,
    tokenSplit,
    sessions,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/aggregate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/aggregate.ts test/aggregate.test.ts test/fixtures/sample.ts
git commit -m "feat: aggregate ccusage daily+session into dashboard DTO"
```

---

## Task 5: ccusage runner (`ccusage.ts`)

**Files:**
- Create: `src/ccusage.ts`
- Test: `test/ccusage.test.ts`

- [ ] **Step 1: Write the failing test (for the pure arg builder)**

`test/ccusage.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { buildCcusageArgs } from "../src/ccusage";

describe("buildCcusageArgs", () => {
  test("includes since and until when present", () => {
    expect(buildCcusageArgs("claude", "daily", { since: "2026-05-01", until: "2026-05-02" })).toEqual([
      "claude",
      "daily",
      "--json",
      "--since",
      "2026-05-01",
      "--until",
      "2026-05-02",
    ]);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/ccusage.test.ts`
Expected: FAIL — cannot find module `../src/ccusage`.

- [ ] **Step 3: Write implementation**

`src/ccusage.ts`:
```ts
import type { DateRange } from "./types";

export type Grouping = "daily" | "session";

export class CcusageError extends Error {
  readonly stderr?: string;
  constructor(message: string, stderr?: string) {
    super(message);
    this.name = "CcusageError";
    this.stderr = stderr;
  }
}

export function buildCcusageArgs(tool: string, grouping: Grouping, range: DateRange): string[] {
  const args = [tool, grouping, "--json"];
  if (range.since) args.push("--since", range.since);
  if (range.until) args.push("--until", range.until);
  return args;
}

export interface RunOptions {
  bin?: string;
  timeoutMs?: number;
}

export async function runCcusage(
  tool: string,
  grouping: Grouping,
  range: DateRange,
  opts: RunOptions = {},
): Promise<unknown> {
  const binParts = (opts.bin ?? process.env.CCUSAGE_BIN ?? "bunx ccusage").split(" ");
  const head = binParts[0];
  if (!head) throw new CcusageError("CCUSAGE_BIN is empty");
  const cmd = [head, ...binParts.slice(1), ...buildCcusageArgs(tool, grouping, range)];

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
    if (timedOut) throw new CcusageError("ccusage timed out", stderr);
    if (code !== 0) throw new CcusageError(`ccusage exited with code ${code}`, stderr);
    try {
      return JSON.parse(stdout);
    } catch {
      throw new CcusageError("failed to parse ccusage JSON output", stdout.slice(0, 500));
    }
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/ccusage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ccusage.ts test/ccusage.test.ts
git commit -m "feat: add ccusage arg builder and spawn runner"
```

---

## Task 6: Usage request handler (`usage-handler.ts`)

**Files:**
- Create: `src/usage-handler.ts`
- Test: `test/usage-handler.test.ts`

- [ ] **Step 1: Write the failing test**

`test/usage-handler.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { handleUsage, type HandlerDeps } from "../src/usage-handler";
import { sampleDaily, sampleSession, emptyDaily, emptySession } from "./fixtures/sample";
import { CcusageError } from "../src/ccusage";

const NOW = new Date(2026, 4, 30);

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    now: () => NOW,
    run: async (_tool, grouping) => (grouping === "daily" ? sampleDaily : sampleSession),
    ...over,
  };
}

function req(qs: string): Request {
  return new Request(`http://localhost/api/usage?${qs}`);
}

describe("handleUsage", () => {
  test("returns 200 with aggregated data for a valid request", async () => {
    const res = await handleUsage(req("tool=claude&template=last-7-days"), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.totalCost).toBe(7);
    expect(body.range).toEqual({
      tool: "claude",
      template: "last-7-days",
      since: "2026-05-24",
      until: "2026-05-30",
    });
  });

  test("rejects an unsupported tool with 400", async () => {
    const res = await handleUsage(req("tool=bogus&template=today"), deps());
    expect(res.status).toBe(400);
  });

  test("rejects an unknown template with 400", async () => {
    const res = await handleUsage(req("tool=claude&template=nope"), deps());
    expect(res.status).toBe(400);
  });

  test("rejects a custom range with since after until (400)", async () => {
    const res = await handleUsage(
      req("tool=claude&template=custom&since=2026-03-01&until=2026-02-01"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  test("maps a CcusageError to 502", async () => {
    const res = await handleUsage(
      req("tool=claude&template=today"),
      deps({
        run: async () => {
          throw new CcusageError("ccusage not found");
        },
      }),
    );
    expect(res.status).toBe(502);
  });

  test("returns 200 zeroed dashboard for an empty range", async () => {
    const res = await handleUsage(
      req("tool=claude&template=today"),
      deps({ run: async (_t, g) => (g === "daily" ? emptyDaily : emptySession) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.sessionCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/usage-handler.test.ts`
Expected: FAIL — cannot find module `../src/usage-handler`.

- [ ] **Step 3: Write implementation**

`src/usage-handler.ts`:
```ts
import { aggregate } from "./aggregate";
import { CcusageError, type Grouping } from "./ccusage";
import { resolveRange } from "./ranges";
import {
  type CcusageDailyReport,
  type CcusageSessionReport,
  type DashboardData,
  type DateRange,
  SUPPORTED_TOOLS,
  type TemplateId,
} from "./types";

export interface HandlerDeps {
  run: (tool: string, grouping: Grouping, range: DateRange) => Promise<unknown>;
  now: () => Date;
}

const TEMPLATES: readonly TemplateId[] = [
  "today",
  "last-7-days",
  "this-month",
  "last-month",
  "last-30-days",
  "all-time",
  "custom",
];

export async function handleUsage(req: Request, deps: HandlerDeps): Promise<Response> {
  const url = new URL(req.url);
  const tool = url.searchParams.get("tool") ?? "";
  const template = (url.searchParams.get("template") ?? "") as TemplateId;

  if (!(SUPPORTED_TOOLS as readonly string[]).includes(tool)) {
    return json({ error: `unsupported tool: ${tool || "(none)"}` }, 400);
  }
  if (!TEMPLATES.includes(template)) {
    return json({ error: `unknown template: ${template || "(none)"}` }, 400);
  }

  let range: DateRange;
  try {
    range = resolveRange(template, deps.now(), {
      since: url.searchParams.get("since") ?? undefined,
      until: url.searchParams.get("until") ?? undefined,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  try {
    const [daily, session] = await Promise.all([
      deps.run(tool, "daily", range) as Promise<CcusageDailyReport>,
      deps.run(tool, "session", range) as Promise<CcusageSessionReport>,
    ]);
    const data: DashboardData = aggregate(daily, session, {
      tool,
      template,
      since: range.since,
      until: range.until,
    });
    return json(data, 200);
  } catch (e) {
    if (e instanceof CcusageError) {
      return json({ error: e.message, detail: e.stderr }, 502);
    }
    return json({ error: "internal error" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
```

> Note: the spec lists `504` for spawn timeouts; this implementation surfaces a timeout as a `CcusageError` → `502` with a "timed out" message. Acceptable for v1; revisit if a distinct status is needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/usage-handler.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full suite + typecheck + lint**

Run: `bun test && bun run typecheck && bun run lint`
Expected: all pass; lint clean (fix any Biome findings, e.g. with `bun run format`).

- [ ] **Step 6: Commit**

```bash
git add src/usage-handler.ts test/usage-handler.test.ts
git commit -m "feat: add /api/usage request handler with validation + error mapping"
```

---

## Task 7: Server wiring (`server.ts`)

**Files:**
- Create: `src/server.ts`

(The HTML import in Step 1 resolves once `web/index.html` exists in Task 8; if you implement Task 7 before Task 8, create a one-line placeholder `web/index.html` containing `<!doctype html><title>ccusage-dash</title>` so the import resolves, then flesh it out in Task 8.)

- [ ] **Step 1: Write `src/server.ts`**

```ts
import index from "../web/index.html";
import { runCcusage } from "./ccusage";
import { handleUsage } from "./usage-handler";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/api/usage": {
      GET: (req) => handleUsage(req, { run: runCcusage, now: () => new Date() }),
    },
  },
});

console.log(`ccusage-dash running at http://localhost:${server.port}`);
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: exits 0. (Bun's bundler resolves the `.html` import at runtime; `@types/bun` declares the module type.)

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: wire Bun.serve with html route and /api/usage"
```

---

## Task 8: Frontend (`web/index.html` + `web/main.ts`)

**Files:**
- Create: `web/index.html`, `web/main.ts`

- [ ] **Step 1: Write `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ccusage-dash</title>
    <style>
      :root { --bg:#0f1115; --panel:#181b22; --line:#272b34; --fg:#e6e8ec; --muted:#9aa3b2; --accent:#4f8cff; }
      * { box-sizing: border-box; }
      body { margin:0; font:14px/1.5 system-ui,sans-serif; background:var(--bg); color:var(--fg); }
      header { display:flex; gap:10px; align-items:center; flex-wrap:wrap;
        padding:12px 16px; background:var(--panel); border-bottom:1px solid var(--line); position:sticky; top:0; }
      header strong { font-size:16px; margin-right:8px; }
      select, input[type="date"], button { background:#11141a; color:var(--fg);
        border:1px solid var(--line); border-radius:6px; padding:6px 10px; font:inherit; }
      .chip { cursor:pointer; }
      .chip[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:#fff; }
      #custom { display:none; gap:6px; align-items:center; }
      #custom.show { display:inline-flex; }
      button#run { margin-left:auto; cursor:pointer; background:var(--accent); border-color:var(--accent); color:#fff; }
      main { padding:16px; max-width:1200px; margin:0 auto; }
      #status { color:var(--muted); padding:8px 0; min-height:24px; }
      .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
      .kpi { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
      .kpi .label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
      .kpi .value { font-size:24px; font-weight:600; margin-top:4px; }
      .grid { display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px; }
      .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
      .panel h3 { margin:0 0 10px; font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th, td { text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }
      th { color:var(--muted); font-weight:500; }
      td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
    </style>
  </head>
  <body>
    <header>
      <strong>ccusage-dash</strong>
      <select id="tool" aria-label="Tool"></select>
      <span id="templates"></span>
      <span id="custom">
        <input type="date" id="since" aria-label="Since" />
        <input type="date" id="until" aria-label="Until" />
      </span>
      <button id="run">Run</button>
    </header>
    <main>
      <div id="status">Pick a tool and range, then Run.</div>
      <section class="kpis" id="kpis" hidden></section>
      <div class="grid">
        <div class="panel"><h3>Cost &amp; tokens over time</h3><canvas id="timeChart"></canvas></div>
        <div class="panel"><h3>By model</h3><canvas id="modelChart"></canvas></div>
      </div>
      <div class="panel" style="margin-bottom:10px"><h3>Token type split</h3><canvas id="tokenChart"></canvas></div>
      <div class="panel"><h3>Sessions</h3><div id="tableWrap"></div></div>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `web/main.ts`**

```ts
import { Chart, registerables } from "chart.js";
import { SUPPORTED_TOOLS, type DashboardData, type TemplateId } from "../src/types";

Chart.register(...registerables);

interface Template {
  id: TemplateId;
  label: string;
}
const TEMPLATES: Template[] = [
  { id: "today", label: "Today" },
  { id: "last-7-days", label: "Last 7 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30-days", label: "Last 30 days" },
  { id: "all-time", label: "All time" },
  { id: "custom", label: "Custom" },
];

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

const toolSel = $<HTMLSelectElement>("tool");
const templatesEl = $<HTMLSpanElement>("templates");
const customEl = $<HTMLSpanElement>("custom");
const sinceEl = $<HTMLInputElement>("since");
const untilEl = $<HTMLInputElement>("until");
const runBtn = $<HTMLButtonElement>("run");
const statusEl = $<HTMLDivElement>("status");
const kpisEl = $<HTMLElement>("kpis");
const tableWrap = $<HTMLDivElement>("tableWrap");

let selectedTemplate: TemplateId = "last-7-days";
const charts: Record<string, Chart | undefined> = {};

function initControls(): void {
  for (const t of SUPPORTED_TOOLS) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    toolSel.append(opt);
  }
  for (const t of TEMPLATES) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = t.label;
    b.dataset.id = t.id;
    b.setAttribute("aria-pressed", String(t.id === selectedTemplate));
    b.addEventListener("click", () => selectTemplate(t.id));
    templatesEl.append(b);
  }
  runBtn.addEventListener("click", () => void run());
}

function selectTemplate(id: TemplateId): void {
  selectedTemplate = id;
  for (const b of templatesEl.querySelectorAll<HTMLButtonElement>(".chip")) {
    b.setAttribute("aria-pressed", String(b.dataset.id === id));
  }
  customEl.classList.toggle("show", id === "custom");
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function run(): Promise<void> {
  const params = new URLSearchParams({ tool: toolSel.value, template: selectedTemplate });
  if (selectedTemplate === "custom") {
    if (!sinceEl.value || !untilEl.value) {
      statusEl.textContent = "Custom range needs both a start and end date.";
      return;
    }
    params.set("since", sinceEl.value);
    params.set("until", untilEl.value);
  }
  statusEl.textContent = "Running ccusage…";
  runBtn.disabled = true;
  try {
    const res = await fetch(`/api/usage?${params}`);
    const body = await res.json();
    if (!res.ok) {
      statusEl.textContent = `Error: ${body.error ?? res.statusText}`;
      return;
    }
    render(body as DashboardData);
  } catch (e) {
    statusEl.textContent = `Request failed: ${(e as Error).message}`;
  } finally {
    runBtn.disabled = false;
  }
}

function render(data: DashboardData): void {
  const r = data.range;
  statusEl.textContent = `${r.tool} · ${r.template}${r.since ? ` · ${r.since} → ${r.until}` : " · all time"}`;

  if (data.sessions.length === 0) {
    kpisEl.hidden = true;
    tableWrap.innerHTML = "<p>No usage in this range.</p>";
    for (const c of Object.values(charts)) c?.destroy();
    return;
  }

  kpisEl.hidden = false;
  kpisEl.innerHTML = "";
  const kpiDefs: [string, string][] = [
    ["Total cost", fmtUsd(data.kpis.totalCost)],
    ["Total tokens", fmtNum(data.kpis.totalTokens)],
    ["Sessions", fmtNum(data.kpis.sessionCount)],
    ["Active days", fmtNum(data.kpis.activeDays)],
  ];
  for (const [label, value] of kpiDefs) {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    kpisEl.append(div);
  }

  renderTimeChart(data);
  renderModelChart(data);
  renderTokenChart(data);
  renderTable(data);
}

function canvas(id: string): HTMLCanvasElement {
  return $<HTMLCanvasElement>(id);
}

function renderTimeChart(data: DashboardData): void {
  charts.time?.destroy();
  charts.time = new Chart(canvas("timeChart"), {
    data: {
      labels: data.daily.map((d) => d.date),
      datasets: [
        { type: "bar", label: "Tokens", yAxisID: "y1", data: data.daily.map((d) => d.totalTokens) },
        { type: "line", label: "Cost (USD)", yAxisID: "y", data: data.daily.map((d) => d.cost) },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { position: "left", title: { display: true, text: "USD" } },
        y1: { position: "right", title: { display: true, text: "tokens" }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

function renderModelChart(data: DashboardData): void {
  charts.model?.destroy();
  charts.model = new Chart(canvas("modelChart"), {
    type: "doughnut",
    data: {
      labels: data.byModel.map((m) => m.model),
      datasets: [{ data: data.byModel.map((m) => Number(m.cost.toFixed(4))) }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

function renderTokenChart(data: DashboardData): void {
  charts.token?.destroy();
  const s = data.tokenSplit;
  charts.token = new Chart(canvas("tokenChart"), {
    type: "bar",
    data: {
      labels: ["Input", "Output", "Cache create", "Cache read"],
      datasets: [{ label: "Tokens", data: [s.input, s.output, s.cacheCreate, s.cacheRead] }],
    },
    options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } } },
  });
}

function renderTable(data: DashboardData): void {
  const rows = [...data.sessions].sort((a, b) => b.totalCost - a.totalCost);
  const head =
    "<table><thead><tr><th>Project</th><th>Models</th><th class='num'>Tokens</th><th class='num'>Cost</th><th>Last activity</th></tr></thead><tbody>";
  const body = rows
    .map(
      (s) =>
        `<tr><td>${s.projectPath}</td><td>${s.modelsUsed.join(", ")}</td>` +
        `<td class="num">${fmtNum(s.totalTokens)}</td><td class="num">${fmtUsd(s.totalCost)}</td>` +
        `<td>${s.lastActivity}</td></tr>`,
    )
    .join("");
  tableWrap.innerHTML = `${head}${body}</tbody></table>`;
}

initControls();
```

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`
Then open `http://localhost:3000`. Verify:
- Tool dropdown lists the 8 tools; template chips render; "Custom" reveals two date inputs.
- Select `claude` + `Last 7 days` + Run → KPI cards, time chart, model doughnut, token bar, and sessions table populate from live data.
- Pick `Custom` with a valid since/until → renders. Pick a range with no data → "No usage in this range."

Stop with Ctrl-C.

- [ ] **Step 4: Lint + typecheck**

Run: `bun run typecheck && bun run lint`
Expected: pass (run `bun run format` to fix style).

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/main.ts
git commit -m "feat: add dashboard frontend (controls + Chart.js widgets)"
```

---

## Task 9: Documentation deliverables

**Files:**
- Create: `docs/adr/0001-wrap-ccusage-cli.md`, `docs/adr/0002-bun-vanilla-chartjs.md`, `docs/adr/0003-on-demand-no-cache.md`, `docs/ARCHITECTURE.md`, `README.md`
- Modify: `AGENTS.md`, `.github/workflows/ci.yml`

- [ ] **Step 1: Write `docs/adr/0001-wrap-ccusage-cli.md`**

```markdown
# ADR 0001: Wrap the ccusage CLI rather than parse logs ourselves

- Status: Accepted
- Date: 2026-05-30

## Context
ccusage already reads each agent's local logs and computes tokens + cost with model
pricing. Re-implementing log discovery and pricing would duplicate a maintained tool.

## Decision
Treat ccusage as the data source. Spawn `bunx ccusage <tool> <grouping> --json` and consume
its structured output. We own only selection UX and aggregation/presentation.

## Consequences
- (+) No pricing/log-format maintenance; new tools ccusage supports come "for free".
- (+) `--json` is a stable, parseable contract.
- (−) Hard dependency on the ccusage binary and its JSON shape; a few-seconds spawn per query.
- Mitigation: `CCUSAGE_BIN` is configurable; errors surface as a clear banner.
```

- [ ] **Step 2: Write `docs/adr/0002-bun-vanilla-chartjs.md`**

```markdown
# ADR 0002: Bun + vanilla TypeScript + Chart.js, no frontend framework

- Status: Accepted
- Date: 2026-05-30

## Context
The app is a small, single-page, local dashboard. We already use `bunx`.

## Decision
Server: Bun (`Bun.serve`) with fullstack HTML routes (auto-bundles the frontend TS).
Frontend: vanilla TypeScript + Chart.js. Lint/format with Biome. Tests with `bun test`.

## Consequences
- (+) Minimal footprint, no build step beyond Bun's bundler, fast to build and reason about.
- (+) One toolchain (Bun) for server, bundling, and tests.
- (−) Manual DOM wiring instead of a reactive framework — acceptable at this scope.
- Revisit if the UI grows enough to warrant Svelte/React.
```

- [ ] **Step 3: Write `docs/adr/0003-on-demand-no-cache.md`**

```markdown
# ADR 0003: Fetch data on demand, no cache (v1)

- Status: Accepted
- Date: 2026-05-30

## Context
ccusage reads logs and returns within a few seconds. The dashboard is single-user and local.

## Decision
Each `/api/usage` request spawns ccusage fresh (daily + session), aggregates, and returns.
No caching layer in v1.

## Consequences
- (+) Always fresh; simplest possible data path.
- (−) Repeat queries re-run ccusage (a few seconds each).
- A short-lived in-memory cache keyed by `(tool, since, until)` is the noted future upgrade.
```

- [ ] **Step 4: Write `docs/ARCHITECTURE.md`**

```markdown
# Architecture

ccusage-dash is a local, single-user web app that wraps the external `ccusage` CLI.

## Data flow

```
Browser (top control bar: tool + date template)
  │  GET /api/usage?tool=&template=[&since=&until=]
  ▼
Bun server (src/server.ts)
  ├─ usage-handler.ts  validate params → resolveRange(template, now) (ranges.ts)
  ├─ ccusage.ts        spawn `bunx ccusage <tool> daily --json …` and `… session --json …`
  ├─ aggregate.ts      daily + session JSON → DashboardData DTO
  ▼
Browser (dashboard: KPI cards, Chart.js time/model/token charts, sessions table) — web/main.ts
```

## Modules
- `src/types.ts` — ccusage JSON shapes, dashboard DTO, supported-tool list.
- `src/ranges.ts` — pure date-template → {since, until} resolution (testable with injected `now`).
- `src/ccusage.ts` — `buildCcusageArgs` (pure) + `runCcusage` (Bun.spawn) + `CcusageError`.
- `src/aggregate.ts` — pure combination of daily + session reports into the DTO.
- `src/usage-handler.ts` — request handling with injected deps (`run`, `now`) for testability.
- `src/server.ts` — `Bun.serve` routes (`/` HTML, `/api/usage`).
- `web/index.html`, `web/main.ts` — controls + rendering.

## Configuration
- `PORT` (default 3000), `CCUSAGE_BIN` (default `bunx ccusage`).

## Testing
`bun test` covers `ranges`, `aggregate`, `buildCcusageArgs`, and `usage-handler` (fake runner).
The live spawn and the frontend are verified by a manual `bun run dev` smoke test.
```

- [ ] **Step 5: Write `README.md`**

```markdown
# ccusage-dash

A small local web dashboard that wraps the [`ccusage`](https://www.npmjs.com/package/ccusage)
CLI. Pick a coding-agent tool (claude, codex, …) and a date range in the browser; it runs
ccusage and renders an aggregated usage dashboard — KPI cards, cost/tokens over time,
breakdown by model, token-type split, and a sessions table.

## Requirements
- [Bun](https://bun.sh) ≥ 1.3
- `ccusage` is invoked via `bunx` (downloaded on first run); override with `CCUSAGE_BIN`.

## Setup
```sh
bun install
bun run dev      # http://localhost:3000
```

## Usage
Open the URL, choose a tool + date template (or a custom range), and press **Run**.

## Scripts
| Command | Purpose |
|---|---|
| `bun run dev` | Start the dev server (watch mode) |
| `bun run start` | Start in production mode |
| `bun test` | Run the test suite |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome lint + format check |

## Configuration
- `PORT` — server port (default `3000`)
- `CCUSAGE_BIN` — command used to invoke ccusage (default `bunx ccusage`)

## Docs
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/adr/`
```

- [ ] **Step 6: Backfill real commands into `AGENTS.md`**

Replace the placeholder Setup and Build·Test·Lint sections in `AGENTS.md` with the real commands:

```markdown
## Setup

```sh
bun install
```

## Build · Test · Lint

| Task  | Command              |
|-------|----------------------|
| Dev   | `bun run dev`        |
| Test  | `bun test`           |
| Types | `bun run typecheck`  |
| Lint  | `bun run lint`       |
```

Also update the "Project structure" section to point at `src/`, `web/`, `test/`, and `docs/`.

- [ ] **Step 7: Backfill real commands into `.github/workflows/ci.yml`**

Replace the placeholder steps with a Bun job:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test-and-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test
```

- [ ] **Step 8: Verify the whole project**

Run: `bun install && bun run lint && bun run typecheck && bun test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add docs/adr docs/ARCHITECTURE.md README.md AGENTS.md .github/workflows/ci.yml
git commit -m "docs: add ADRs, architecture, README; backfill real commands"
```

---

## Done criteria (maps to spec §11)

- [ ] `bun run dev` serves the control bar + empty state.
- [ ] Tool + template + Run renders all four widget groups from live ccusage data.
- [ ] Custom date picker queries correctly; `all-time` omits bounds and renders.
- [ ] Empty ranges show "No usage in this range"; ccusage failures show an error banner (502).
- [ ] `bun test` passes; `ranges` and `aggregate` (and `buildCcusageArgs`, `usage-handler`) covered.
- [ ] `bun run typecheck` and `bun run lint` are clean.
- [ ] ADRs 0001–0003, `ARCHITECTURE.md`, `README.md` exist; `AGENTS.md` + CI carry real commands.
```


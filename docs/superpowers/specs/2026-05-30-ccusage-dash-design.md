# ccusage-dash — Design Spec

- **Date**: 2026-05-30
- **Status**: Approved (brainstorming) — ready for implementation planning
- **Topic**: Local web dashboard that wraps the external `ccusage` CLI

## 1. Context

[`ccusage`](https://www.npmjs.com/package/ccusage) is an existing CLI that reads local
coding-agent logs (Claude Code, Codex, opencode, …) and reports token usage and cost.
It supports per-tool commands (`claude`, `codex`, `opencode`, `gemini`, `copilot`, …),
each groupable by `daily` / `weekly` / `monthly` / `session` / `blocks`, and emits clean
structured output with `--json` and date filtering with `--since` / `--until`.

We want a small app that lets a user pick a tool and a date range from the browser, runs
`ccusage`, and presents an **aggregated dashboard** of the results. This repository is
greenfield (only an agent-ready baseline exists).

### Verified data shape (captured 2026-05-30)

`ccusage claude session --json --since 2026-05-01` returns:

```json
{
  "sessions": [
    {
      "sessionId": "1b21e36a-…",
      "projectPath": "-Users-danilo-Progetti-DICE-flutter",
      "lastActivity": "2026-05-30",
      "inputTokens": 21648,
      "outputTokens": 381173,
      "cacheCreationTokens": 3363264,
      "cacheReadTokens": 99848082,
      "totalTokens": 103614167,
      "totalCost": 76.40736879999989,
      "modelsUsed": ["claude-sonnet-4-6", "claude-opus-4-8"],
      "modelBreakdowns": [
        { "modelName": "claude-opus-4-8", "inputTokens": 15528, "outputTokens": 299929,
          "cacheCreationTokens": 2678468, "cacheReadTokens": 91658246, "cost": 70.145413 }
      ]
    }
  ]
}
```

The `daily` grouping returns analogous per-date entries (used for the time series).
`--since 2026-05-01` (ISO) is confirmed working; `--until` format to be verified during
implementation (expected to accept the same ISO form).

## 2. Goals / Non-Goals

**Goals**
- Browser form to select a **tool** and a **date-range template** (or custom dates).
- Run `ccusage` on demand and render an aggregated dashboard: KPI cards, cost/tokens over
  time, breakdown by model, token-type split, and a sortable sessions table.
- Ship the project's documentation foundation: ADRs, architecture doc, README, real
  build/test/lint commands.

**Non-Goals (YAGNI)**
- No authentication, no database, no multi-user, no historical/persisted storage.
- No editing or mutation of ccusage data — strictly a read-only viewer.
- No caching in v1 (data is fetched on demand; caching is a noted future upgrade).

## 3. Decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| Selection UI | In the web page (local server serves one page; submit runs ccusage) |
| Runtime / server | Bun + TypeScript (`Bun.serve`) |
| Frontend | Vanilla TypeScript + Chart.js (no framework); Bun bundles the TS |
| Widgets | KPI cards · cost/tokens over time · breakdown by model · token-type split + sessions table |
| Date templates | Today, Last 7 days, This month, Last month, Last 30 days, All time, + custom since/until |
| Data fetch | On-demand spawn, no cache; always fresh |
| ccusage invocation | `bunx ccusage` by default; overridable via `CCUSAGE_BIN` env |
| Layout | A — controls in a top bar, results full-width below |

## 4. Architecture

```
Browser (form) ──GET /api/usage?tool&template[&since&until]──▶ Bun server
                                                                 │ resolve range (ranges.ts)
                                                                 │ spawn `bunx ccusage <tool> daily   --json --since --until`
                                                                 │ spawn `bunx ccusage <tool> session --json --since --until`
                                                                 │ parse (ccusage.ts) + aggregate (aggregate.ts)
Browser (dashboard) ◀──────────── combined dashboard JSON ───────┘
```

### Components

- **`src/server.ts`** — `Bun.serve`. Routes: `GET /` (serve `web/index.html` + bundled JS),
  `GET /api/usage` (dashboard data). Reads env `PORT` (default 3000), `CCUSAGE_BIN`
  (default `bunx ccusage`).
- **`src/ranges.ts`** — pure function `resolveRange(templateId, now, custom?) → {since, until}`.
  "now" is injected for testability. `all-time` → no `since`/`until`.
- **`src/ccusage.ts`** — `runCcusage(tool, grouping, range) → parsed JSON` via `Bun.spawn`;
  surfaces missing-binary, non-zero-exit, malformed-JSON, and timeout errors.
- **`src/aggregate.ts`** — pure: combine `daily` + `session` JSON into the dashboard DTO.
- **`src/types.ts`** — ccusage JSON shapes + dashboard DTO.
- **`web/index.html` + `web/main.ts`** — top control bar (tool `<select>`, template chips,
  custom date inputs, Run button), `fetch('/api/usage')`, render KPI cards, three Chart.js
  charts, and the sessions table.

### Supported tools (dropdown)

A constant list seeded from `ccusage --help`: `claude`, `codex`, `opencode`, `gemini`,
`copilot`, `amp`, `droid`, `goose` (extendable). Default selection: `claude`.

## 5. API contract

`GET /api/usage?tool=<tool>&template=<id>` (or `&template=custom&since=YYYY-MM-DD&until=YYYY-MM-DD`)

Response `200`:
```json
{
  "range": { "tool": "claude", "template": "last-7-days", "since": "2026-05-24", "until": "2026-05-30" },
  "kpis": { "totalCost": 0, "totalTokens": 0, "sessionCount": 0, "activeDays": 0 },
  "daily": [ { "date": "2026-05-24", "cost": 0, "inputTokens": 0, "outputTokens": 0,
               "cacheCreationTokens": 0, "cacheReadTokens": 0, "totalTokens": 0 } ],
  "byModel": [ { "model": "claude-opus-4-8", "cost": 0, "totalTokens": 0,
                 "inputTokens": 0, "outputTokens": 0, "cacheCreationTokens": 0, "cacheReadTokens": 0 } ],
  "tokenSplit": { "input": 0, "output": 0, "cacheCreate": 0, "cacheRead": 0 },
  "sessions": [ { "sessionId": "…", "projectPath": "…", "modelsUsed": ["…"],
                  "totalTokens": 0, "totalCost": 0, "lastActivity": "2026-05-30" } ]
}
```

**Aggregation rules**: `kpis.totalCost`/`totalTokens` = sums; `sessionCount` = `sessions.length`;
`activeDays` = count of `daily` entries with usage; `byModel` = `session.modelBreakdowns`
summed by `modelName`; `tokenSplit` = token columns summed across the range.

## 6. Date-template mapping (`ranges.ts`)

| Template | since | until |
|---|---|---|
| `today` | today | today |
| `last-7-days` | today − 6d | today |
| `this-month` | 1st of current month | today |
| `last-month` | 1st of previous month | last day of previous month |
| `last-30-days` | today − 29d | today |
| `all-time` | (omit) | (omit) |
| `custom` | user `since` | user `until` |

## 7. Error handling

| Condition | Server | Client |
|---|---|---|
| ccusage binary missing / bunx fails | `502` + message | error banner |
| Empty range (no sessions) | `200` empty DTO | "No usage in this range" |
| Malformed ccusage JSON | `502` (log stderr) | error banner |
| Invalid custom dates | `400` | inline field validation |
| Spawn exceeds ~60s | `502` (timeout surfaced as a CcusageError) | error banner |

## 8. Testing strategy

- Runner: Bun built-in (`bun test`).
- `ranges.ts` — table-driven tests with a fixed injected `now` for every template + custom.
- `aggregate.ts` — captured ccusage `daily`+`session` JSON fixtures → asserted DTO.
- `ccusage.ts` — parser tested against a fixture; spawn boundary mocked/abstracted.
- `tsconfig` `strict: true` for type feedback; lint/format via **Biome** (single fast
  tool, good Bun/TS fit) configured in `biome.json`.

## 9. Documentation deliverables

- `docs/adr/0001-wrap-ccusage-cli.md` — wrap the CLI vs. parse logs ourselves.
- `docs/adr/0002-bun-vanilla-chartjs.md` — Bun + vanilla TS + Chart.js, no framework.
- `docs/adr/0003-on-demand-no-cache.md` — data-fetch strategy.
- `docs/ARCHITECTURE.md` — components + data-flow diagram.
- `README.md` — overview, setup (`bun install`, `bun run dev`), usage.
- Backfill real `build`/`test`/`lint` commands into `AGENTS.md` and `.github/workflows/ci.yml`.

## 10. Project structure (target)

```
src/      server.ts · ccusage.ts · ranges.ts · aggregate.ts · types.ts
web/      index.html · main.ts
test/     ranges.test.ts · aggregate.test.ts · ccusage.test.ts · fixtures/
docs/     ARCHITECTURE.md · adr/ · agent-execution.md
package.json · tsconfig.json · biome.json (or eslint/prettier)
```

## 11. Acceptance criteria

- [ ] `bun run dev` starts the server; opening the URL shows the control bar + empty state.
- [ ] Selecting a tool + template + Run renders all four widget groups from live ccusage data.
- [ ] The custom date picker produces a valid range and queries correctly.
- [ ] `all-time` omits `--since`/`--until` and still renders.
- [ ] Empty ranges and ccusage failures show the defined non-error UI / error banners.
- [ ] `bun test` passes; `ranges.ts` and `aggregate.ts` have unit coverage.
- [ ] `tsconfig` strict passes with no type errors; lint is clean.
- [ ] ADRs (0001–0003), `ARCHITECTURE.md`, and `README.md` exist; `AGENTS.md`/CI carry real commands.

## 12. Open items to verify during build

- Exact accepted format / behavior of ccusage `--until` (expected ISO `YYYY-MM-DD`).
- Field name for the date key in the `daily --json` output (confirm against a live run).

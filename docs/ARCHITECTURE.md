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

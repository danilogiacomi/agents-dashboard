# Spec: Current usage box

> Design produced via brainstorming on 2026-05-31.

## Context / Problem

The dashboard reports historical cost/token usage over a date range, but gives no
view of how much of the *current* rate-limit allowance has been consumed — the kind
of "session % + reset, weekly % + reset" shown on https://claude.ai/settings/usage.

Feasibility investigation (recorded here so it isn't re-litigated):

- **Codex** writes the real data locally. The latest `token_count` event in
  `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl` contains a `rate_limits`
  object with `primary`/`secondary` windows, each having `used_percent`,
  `window_minutes`, and `resets_at` (unix seconds). This matches the Codex CLI
  exactly — no estimation, no network.
- **Claude** does **not** write quota data anywhere local. Transcripts
  (`~/.claude/projects/*.jsonl`) carry only per-message token counts; `policy-limits.json`
  and `stats-cache.json` carry no rate-limit info. The claude.ai percentages come from
  an undocumented server endpoint (see GitHub claude-code#44328, still open). We
  deliberately do **not** call that endpoint. The only locally derivable signal is the
  5-hour rolling block via `ccusage blocks`.

Decision: **local data only, with honest labels.** No remote calls.

## Goal

Add a "Current usage" panel to the dashboard that shows the selected agent's current
rate-limit consumption — percentage used and time until reset — using only local data,
clearly marking Claude's figure as an estimate.

## Scope

- **In scope:**
  - New server module `src/current-usage.ts` exposing `getCurrentUsage(tool, deps)`.
  - New route `GET /api/current-usage?tool=<tool>` in `src/server.ts`, wired with the
    same dependency-injection style as `handleUsage`.
  - **claude**: derive a single "5-hour session" window from `ccusage blocks --json` —
    exact reset time, percentage estimated against the historical-peak block.
  - **codex**: parse the latest rollout log's last `rate_limits` snapshot into one
    window per present sub-window (`primary`, `secondary`), with exact `%`/reset.
  - Any other supported tool: report "not available" gracefully.
  - Frontend `renderCurrentUsage` panel below the `.grid`, above Sessions, following
    the tool dropdown; live client-side reset countdown + 60s background re-fetch.
  - Pure formatting helpers (countdown, percent, window label) in `web/format.ts`.
  - Unit tests for the server derivation and the formatting helpers, with fixtures.

- **Out of scope:**
  - Any call to an undocumented/remote Anthropic usage endpoint.
  - Claude **weekly** usage (no local data source exists).
  - Showing usage for all agents at once (box follows the dropdown).
  - Per-agent configurable token limits (Claude % is historical-peak based only).
  - Tools other than claude/codex producing real data (others show "not available").

## Data shapes

```ts
// src/types.ts
export interface UsageWindow {
  label: string;          // "5-hour session", "Weekly", or "{n}h"/"{n}d"
  usedPercent: number;    // 0–100
  resetsAt: string;       // ISO 8601, absolute
  basis: "exact" | "estimate";
  detail?: string;        // e.g. "21.5M tokens"
}
export interface CurrentUsage {
  tool: string;
  available: boolean;
  windows: UsageWindow[];
  note?: string;          // e.g. estimate caveat, or why unavailable
}
```

## Derivation rules

**claude** — run `ccusage blocks --json` (reuse the `CCUSAGE_BIN` spawn path):
- Active block = the entry with `isActive: true`.
- `resetsAt` = active block `endTime` (exact).
- `usedPercent` = `activeBlock.totalTokens / maxTotalTokens * 100`, where
  `maxTotalTokens` = max `totalTokens` over all non-gap (`isGap: false`) blocks.
  Clamp to `[0, 100]`; if `maxTotalTokens` is 0, percent is 0.
- `basis: "estimate"`; `note` explains it is relative to the busiest 5-hour block,
  not a true plan limit.
- `detail` = humanized active-block `totalTokens`.
- No active block → `available: true`, `windows: []`, `note: "no active session in
  the last 5 hours"`. (Empty `windows` avoids inventing a `resetsAt` that doesn't exist.)

**codex** — locate the most recently modified `rollout-*.jsonl` under
`CODEX_HOME ?? ~/.codex` → `sessions/`; read its **last** `token_count` event with a
`rate_limits` object. For each non-null sub-window:
- `usedPercent` = `used_percent`; `resetsAt` = `new Date(resets_at * 1000)`;
  `basis: "exact"`.
- `label` from `window_minutes`: ~300 → "5-hour session", 10080 → "Weekly",
  else `{Math.round(window_minutes/60)}h` (or `/1440`d when a whole number of days).
- No log / no `rate_limits` → `available: false` with an explanatory note.

**other supported tools** → `available: false`,
`note: "current usage not available for this agent yet"`.

## Architecture notes

- `getCurrentUsage` takes injected deps (`runBlocks`/`run`, `now`, and a codex-log
  reader) so it is pure and unit-testable with fixtures — mirroring `HandlerDeps`.
- Reset countdowns are computed client-side from the absolute `resetsAt`, so the label
  stays live between the 60s data re-fetches.
- The panel is hidden/empty-stated when `available` is false, never showing a fake bar.

## Acceptance criteria

- [ ] `GET /api/current-usage?tool=claude` returns a `CurrentUsage` with one
      `estimate` window, exact `resetsAt`, and a percent in `[0,100]`.
- [ ] `GET /api/current-usage?tool=codex` returns one `exact` window per present
      `rate_limits` sub-window, with correct labels and ISO reset times.
- [ ] An unsupported/dataless tool returns `available: false` with a note; the UI
      shows the note, not a bar.
- [ ] The panel renders below "Cost & tokens over time" / above Sessions, follows the
      tool dropdown, and updates the countdown every second plus re-fetches every 60s.
- [ ] Claude's window is visibly labeled an estimate; Codex windows are not.
- [ ] Unit tests cover: claude percent/reset math (incl. no-active-block and zero-peak),
      codex window parsing/labeling (incl. missing `secondary`), unsupported tool, and
      the formatting helpers. All pass.
- [ ] `bun test` and `bun run lint` are clean.

## Notes / open questions

- If/when Anthropic ships an official usage endpoint (claude-code#44328), Claude's
  window can be upgraded from `estimate` to `exact` without changing the API shape.
- Codex `window_minutes` labeling uses approximate matches; if observed values differ
  from 300/10080, widen the mapping during implementation.

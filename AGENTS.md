# ccusage

> Canonical agent + contributor instructions. Read by Claude Code (via the `CLAUDE.md`
> symlink), Codex, opencode, and pi natively. Keep this file the single source of truth.

## Overview

Agents Dashboard is a local, single-user web dashboard that wraps the `ccusage` CLI.
Pick a coding-agent tool and a date range in the browser; it spawns ccusage and renders
KPI cards, cost/tokens over time, model breakdown, and a sessions table.

## Setup

```sh
bun install
```

## Build · Test · Lint

| Task  | Command              |
|-------|----------------------|
| Dev   | `bun run dev`        |
| Start | `bun run start`      |
| Test  | `bun test`           |
| Types | `bun run typecheck`  |
| Lint  | `bun run lint`       |

Run **test + lint** before considering any task done. See
[verification](#verification) below.

## Project structure

- `src/` — server + logic modules (types, ranges, aggregate, ccusage, usage-handler, server)
- `web/` — index.html + main.ts frontend
- `test/` — bun tests + fixtures
- `docs/` — ARCHITECTURE.md + adr/
- `specs/` — task specifications

## Code style

Formatter/linter config: `biome.json` (run `bun run lint` / `bun run format`).
Follow the configured formatter and linter; do not hand-format. Match the
conventions of surrounding code.

## Verification

A change is complete only when:
1. The relevant tests pass.
2. The linter/formatter reports no new issues.
3. The change is described against its spec (if one exists in `specs/`).

Do not claim success without running the commands and reading their output.

## Safe to run / security

- **Safe without approval:** read-only inspection (`ls`, `git status`, `git diff`,
  reading files), and the build/test/lint commands above.
- **Ask first:** anything that writes outside the repo, installs global tooling,
  makes network calls, deletes files, or pushes/publishes.
- **Never commit secrets.** Use `.env` (gitignored) for local values and keep
  `.env.example` as the documented, value-free template.
- Sandbox/execution policy for agents: see [`docs/agent-execution.md`](docs/agent-execution.md).

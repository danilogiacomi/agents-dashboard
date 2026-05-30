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

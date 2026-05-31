# ccusage-dash

A small local web dashboard that wraps the [`ccusage`](https://www.npmjs.com/package/ccusage)
CLI. Pick a coding-agent tool (claude, codex, …) and a date range in the browser; it runs
ccusage, aggregates the result, and renders KPI cards, cost/tokens over time, a breakdown by
model, a token-type split, and a sessions table.

## Quick start

With [Bun](https://bun.sh) ≥ 1.3 installed, run it straight from GitHub — no clone needed:

```sh
bunx github:danilogiacomi/ccusage-dash
```

Then open <http://localhost:3000>. On a different port:

```sh
PORT=8080 bunx github:danilogiacomi/ccusage-dash
```

## Requirements

- [Bun](https://bun.sh) ≥ 1.3 (runs the server and bundles the frontend — no build step).
- `ccusage` itself is invoked via `bunx` and downloaded on first use; override the command
  with the `CCUSAGE_BIN` environment variable if you have it installed elsewhere.
- The dashboard reads whatever local agent logs `ccusage` can see on your machine.

## Usage

The dashboard **queries automatically** — there is no Run button:

- It loads usage for **claude / last 7 days** on first open.
- Changing the **tool** dropdown or clicking a **date-range** chip (Today, Last 7 days, This
  month, Last month, Last 30 days, All time) re-queries immediately.
- **Custom** reveals two date pickers and queries once both dates are set.

Tools with no data simply show "No usage in this range".

## Configuration

| Variable      | Default        | Purpose                              |
|---------------|----------------|--------------------------------------|
| `PORT`        | `3000`         | Port the server listens on           |
| `CCUSAGE_BIN` | `bunx ccusage` | Command used to invoke ccusage       |

## Development

```sh
git clone https://github.com/danilogiacomi/ccusage-dash.git
cd ccusage-dash
bun install
bun run dev        # watch mode, http://localhost:3000
```

| Command | Purpose |
|---|---|
| `bun run dev` | Start the dev server (watch mode) |
| `bun run start` | Start in production mode |
| `bun test` | Run the test suite |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome lint + format check |

## Notes

- ccusage emits a different JSON schema per tool; ccusage-dash normalizes them into one shape
  (see `src/normalize.ts`). codex reports per-model **tokens** but not per-model **cost**, so
  its "By model" chart (which is cost-based) is empty — the sessions table still lists models.

## Docs

- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Decisions: [`docs/adr/`](docs/adr/)

## License

[MIT](LICENSE) © Danilo Giacomi

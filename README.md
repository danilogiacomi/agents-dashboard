# Agents Dashboard

[![Agent Ready](.agent-ready/badge.svg)](https://github.com/CAF-Agency/agent-ready)

A small local web dashboard that wraps the [`ccusage`](https://www.npmjs.com/package/ccusage)
CLI. Pick a coding-agent tool (claude, codex, …) and a date range in the browser; it runs
ccusage, aggregates the result, and renders KPI cards, cost/tokens over time, a breakdown by
model, a token-type split, and a sessions table.

## Quick start

With [Bun](https://bun.sh) ≥ 1.3 installed, run it straight from GitHub — no clone needed:

```sh
bunx github:danilogiacomi/agents-dashboard
```

If that still shows an older copy, clear Bun's package cache first:

```sh
bun pm cache rm
bunx --force github:danilogiacomi/agents-dashboard
```

Then open <http://localhost:3000>. On a different port:

```sh
PORT=8080 bunx github:danilogiacomi/agents-dashboard
```

### Updating

`bunx` caches the GitHub package by commit, so after the first run it may keep serving the
version you originally pulled. To force the latest from `main`:

```sh
bunx --force github:danilogiacomi/agents-dashboard
```

If you still see an older copy, clear Bun's package cache and try again:

```sh
bun pm cache rm
bunx --force github:danilogiacomi/agents-dashboard
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
git clone https://github.com/danilogiacomi/agents-dashboard.git
cd agents-dashboard
bun install
git config core.hooksPath .githooks   # auto-refresh the "Built by agents" section on commit
bun run dev        # watch mode, http://localhost:3000
```

| Command | Purpose |
|---|---|
| `bun run dev` | Start the dev server (watch mode) |
| `bun run start` | Start in production mode |
| `bun test` | Run the test suite |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome lint + format check |
| `bun run usage:self` | Regenerate the "Built by agents" README section from local agent logs |

The `core.hooksPath` line above enables a pre-commit hook (`.githooks/pre-commit`) that
runs `usage:self` and re-stages `README.md` on each commit, so the footprint stays current.
It is a no-op on machines without local agent logs (CI, fresh clones).

## Notes

- ccusage emits a different JSON schema per tool; Agents Dashboard normalizes them into one shape
  (see `src/normalize.ts`). codex reports per-model **tokens** but not per-model **cost**, so
  its "By model" chart (which is cost-based) is empty — the sessions table still lists models.

## Agent tooling

Opening this repo in an MCP-capable agent (Claude Code, etc.) picks up `.mcp.json`, which
declares the [Serena](https://github.com/oraios/serena) semantic code-navigation server. It
runs via `uvx` (install [uv](https://docs.astral.sh/uv/)); the first launch fetches Serena.

The repo scores **76/100** on the [agent-ready](https://github.com/CAF-Agency/agent-ready)
agentic readiness scale (🟢 Ready). The scan covers agent instructions, navigability,
testing, CI/CD, tooling, security, and spec-driven workflow. Full findings are in
[`.agent-ready/agent-ready-report.md`](.agent-ready/agent-ready-report.md).

## Docs

- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Decisions: [`docs/adr/`](docs/adr/)

<!-- usage:self:start -->

## 🤖 Built by agents

This dashboard is itself built almost entirely by coding agents — fitting, since it
exists to *measure* coding agents. The numbers below are this repo's own development
footprint, read from the local agent logs the dashboard renders.

| Metric | Value |
|---|---|
| **Total tokens** | **310.0M** |
| Token breakdown | 1.7M output · 1.6M input · 7.1M cache-write · 299.6M cache-read |
| Agent time | ~5h 5m active (306h 24m wall-clock) |
| Turns | 1,212 assistant turns · 578 tool calls |
| Agents / models | Claude Code · Codex — claude-opus-4-8, claude-sonnet-4-6 |
| As of | 2026-05-30 → 2026-06-12 |

> 💡 Most of those tokens are *cache reads* — re-reading the growing conversation each
> turn — which is why the total dwarfs the tokens actually written. The dashboard's
> token-type split makes exactly this distinction visible.

_Regenerated by `bun run usage:self` (kept fresh via the repo's pre-commit hook)._

<!-- usage:self:end -->

## License

[MIT](LICENSE) © Danilo Giacomi

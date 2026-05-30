# ccusage

> Canonical agent + contributor instructions. Read by Claude Code (via the `CLAUDE.md`
> symlink), Codex, opencode, and pi natively. Keep this file the single source of truth.

## Overview

<!-- TODO: One paragraph on what this project does and who uses it. -->
_Project description goes here._

## Setup

<!-- TODO-by-stack: replace with real install command once the stack is chosen. -->
```sh
# Node:   npm install
# Python: uv sync   (or: pip install -e .)
# Go:     go mod download
```

## Build · Test · Lint

These are the commands an agent should run to validate a change. Replace the
placeholders with the real commands as soon as the toolchain exists.

| Task  | Command (TODO-by-stack)                          |
|-------|--------------------------------------------------|
| Build | `# e.g. npm run build  /  go build ./...`        |
| Test  | `# e.g. npm test  /  pytest  /  go test ./...`   |
| Lint  | `# e.g. npm run lint  /  ruff check  /  golangci-lint run` |

Run **test + lint** before considering any task done. See
[verification](#verification) below.

## Project structure

<!-- TODO: point to the main source dirs once they exist, e.g. `src/`, `tests/`. -->
- `docs/` — project + agent-execution documentation
- `specs/` — task specifications (use `specs/TEMPLATE.md`)

## Code style

<!-- TODO: link to the formatter/linter config (e.g. .eslintrc, ruff.toml) once added. -->
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

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

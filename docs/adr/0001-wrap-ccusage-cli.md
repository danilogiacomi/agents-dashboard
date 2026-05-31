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

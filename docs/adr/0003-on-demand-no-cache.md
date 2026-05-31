# ADR 0003: Fetch data on demand, no cache (v1)

- Status: Accepted
- Date: 2026-05-30

## Context
ccusage reads logs and returns within a few seconds. The dashboard is single-user and local.

## Decision
Each `/api/usage` request spawns ccusage fresh (daily + session), aggregates, and returns.
No caching layer in v1.

## Consequences
- (+) Always fresh; simplest possible data path.
- (−) Repeat queries re-run ccusage (a few seconds each).
- A short-lived in-memory cache keyed by `(tool, since, until)` is the noted future upgrade.

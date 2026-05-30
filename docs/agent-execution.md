# Agent Execution & Sandbox Policy

This document defines how AI coding agents (Claude Code, Codex, opencode, pi, …)
should execute commands in this repository. It is **vendor-neutral**: the policy
holds regardless of which agent or sandbox you use.

## Principle

Give agents a place to run code where a mistake cannot harm your machine, your
credentials, or production. Prefer an isolated environment over running agents
directly on your host.

## Recommended sandbox options

Pick whichever fits your workflow — listed roughly from lightest to most isolated:

| Option | What it is | Good for |
|--------|------------|----------|
| **[LINCE](https://lince.sh)** | Purpose-built sandbox for running coding agents safely | Day-to-day agent runs with host isolation |
| **Devcontainer** | `.devcontainer/` reproducible container | Consistent, shareable dev environment |
| **OS sandbox** | macOS `sandbox-exec`, Linux namespaces/`bubblewrap`, seccomp | Lightweight per-command confinement |
| **Hosted** | Cloud dev environment / ephemeral CI runner | Fully disposable, zero host exposure |

## Safe-to-run commands (no approval needed)

These are read-only or repo-local and may run automatically:

```sh
ls, cat, find, grep
git status, git diff, git log
# build / test / lint commands from AGENTS.md
```

## Require explicit approval

- Writing or deleting files **outside** the repository
- Installing global tooling or modifying system state
- Network calls (downloads, API requests, package publishing)
- `git push`, releases, or anything that leaves the local machine
- Running with elevated privileges (`sudo`)

## Secrets

Agents must never read, print, or commit secrets. Local secrets live in `.env`
(gitignored); `.env.example` documents the required keys without values.

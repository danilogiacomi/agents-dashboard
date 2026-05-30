# 🌱 Agentic Readiness Report — ccusage

**Mode**: greenfield (fresh `init` baseline) · **Agents**: claude · **Generated**: 2026-05-30
**Overall Score**: **36 / 100** 🟡 Partially Ready
**Script signals**: available (Python 3.14, all 7 helper scripts ran)

## 1. Executive Summary

This is a freshly scaffolded greenfield baseline. The portable safety and instruction
foundations are in place; the gaps are the things that only exist once real code, tests,
and a chosen stack land. Scoring is unchanged from brownfield — greenfield only reframes
remediation as "next steps," not "debt."

```
Agent Instructions & Context      ████████████░░░░  13.3/18
Navigability & Code Intelligence  ███████░░░░░░░░░   7.4/18
Testing & Feedback                █░░░░░░░░░░░░░░░   0.8/16
CI/CD, Automation & Governance    ██████░░░░░░░░░░   5.1/14
Agent Tooling & Capabilities      ░░░░░░░░░░░░░░░░   0.0/12
Security & Sandbox                ████████░░░░░░░░   6.2/12
Spec-Driven Workflow & Docs       █████░░░░░░░░░░░   3.4/10
```

### Top gaps by impact
1. **Testing & Feedback** (+15.2) — no tests/commands yet. _Expected-empty for greenfield; highest lever once code exists._
2. **Agent Tooling** (+12.0) — no MCP declaration or Skills. fix: add `.mcp.json`, wire Serena (skill/manual).
3. **Navigability** (+10.6) — no README, no typed stack. fix: add README + pick a typed stack (partial/manual).
4. **CI/CD & Governance** (+8.9) — CI steps are placeholders; no CODEOWNERS/Dependabot. fix: `/agent-ready fix cicd_automation_governance` (skill).
5. **Spec-Driven & Docs** (+6.6) — no issue/PR templates or ADRs. fix: `/agent-ready fix spec_driven_workflow_docs` (skill).

## 2. Layer Analysis

| Layer | Score | Max |
|-------|-------|-----|
| **Portable** (any agent) | 33.0 | 94.3 |
| **Target-specific** (claude) | 3.2 | 5.7 |

Target layer is small because only `claude` is declared and its one strong signal —
the `CLAUDE.md → AGENTS.md` bridge — is already at 100. Remaining target points
(`custom_commands`, `agent_permission_policy`) are optional / manual.

## 3. Per-Dimension Detail

Affirmations for sub-criteria at 100; explained findings for everything below.

### 1. Agent Instructions & Context — raw 73.75, weighted 13.3/18
| Sub-criterion | Score |
|---|---|
| primary_instruction_file | 75 |
| instruction_quality | 50 |
| instruction_conciseness | 100 ✅ |
| hierarchical_instructions | 50 |
| cross_agent_bridge | 100 ✅ |

- ✅ **instruction_conciseness (100)** — 63 lines, ~583 tokens, 0 boilerplate; well under the 300-line ceiling.
- ✅ **cross_agent_bridge (100)** — `CLAUDE.md` symlinks to `AGENTS.md`; one source of truth, no drift.
- **primary_instruction_file (75)** — _why_: AGENTS.md is the cross-vendor standard agents read first. _evidence_: present and well-structured, but content is templated. _fix_: fill the overview/commands as the project takes shape (skill, Low).
- **instruction_quality (50)** — _why_: value comes from project-specific commands/paths, not boilerplate. _consequence_: placeholder commands force trial-and-error. _fix_: replace TODO-by-stack placeholders with real commands once the stack is chosen (partial, Med).
- **hierarchical_instructions (50)** — _why_: scoped per-package files help large repos. _evidence_: single root file, adequate at current size. _fix_: add nested `AGENTS.md` when packages appear (skill, Med).

### 2. Navigability & Code Intelligence — raw 41.25, weighted 7.4/18
| Sub-criterion | Score |
|---|---|
| repo_map_availability | 50 |
| semantic_nav_amenability | 25 |
| dependency_structure_clarity | 25 |
| readme_overview | 25 |
| machine_readable_contracts | 25 |
| file_size_sanity | 100 ✅ |

- ✅ **file_size_sanity (100)** — 0 oversized files (7 files, 274 LOC total).
- **readme_overview (25)** — _why_: cheapest high-level map of intent. _consequence_: agents misread purpose/entry points. _fix_: add a root `README.md` (partial, Low).
- **repo_map_availability (50)** — no code to map yet; cleanly generatable later (partial, Low).
- **semantic_nav_amenability (25)** / **dependency_structure_clarity (25)** — unlock by choosing a typed stack with a manifest and language server (manual, High).
- **machine_readable_contracts (25)** — author OpenAPI/proto/GraphQL at boundaries when they exist (manual, High).

### 3. Testing & Feedback — raw 5.0, weighted 0.8/16
| Sub-criterion | Score |
|---|---|
| test_suite_present | 0 |
| test_commands_documented | 25 |
| fast_feedback_loop | 0 |
| feedback_quality | 0 |
| coverage_reasonable | 0 |

All low — expected for a repo with no code. _Highest-impact dimension once development starts._
- **test_suite_present (0)** — write a real suite as modules land (manual, High).
- **test_commands_documented (25)** — AGENTS.md has placeholders; `/agent-ready fix testing_feedback` documents real commands once a runner exists (skill, Low).
- **feedback_quality / coverage / fast_feedback (0)** — add a type-checker config, coverage target, and a fast-subset convention with the stack (partial, Med).

### 4. CI/CD, Automation & Governance — raw 36.25, weighted 5.1/14
| Sub-criterion | Score |
|---|---|
| ci_runs_tests_lint | 50 |
| lint_format_automated | 25 |
| pre_commit_hooks | 75 |
| governance | 0 |

- **pre_commit_hooks (75)** — real generic hooks + `detect-secrets`; add stack hooks (ruff/eslint) later (skill, Low).
- **ci_runs_tests_lint (50)** — workflow scaffolded with lint+test jobs but echo placeholders; replace with real commands (skill, Low).
- **lint_format_automated (25)** — no stack linter config yet (skill, Low).
- **governance (0)** — add `CODEOWNERS` + Dependabot/Renovate via `/agent-ready fix cicd_automation_governance` (skill, Low).

### 5. Agent Tooling & Capabilities — raw 0.0, weighted 0.0/12
All sub-criteria at 0 — none scaffolded by `init` (these are project-growth levers).
- **mcp_declaration (0)** — add a baseline `.mcp.json` (skill, Low).
- **standard_skills / bundled_helper_scripts (0)** — scaffold a `SKILL.md` + `scripts/` if you build reusable workflows (partial, Med).
- **nav_comprehension_mcp_servers (0)** — wire Serena once there's code to navigate (manual, Med).
- **custom_commands (0, target)** — optional `.claude/commands/`; prefer Skills (partial, Low).

### 6. Security & Sandbox — raw 51.25, weighted 6.2/12
| Sub-criterion | Score |
|---|---|
| committed_isolation_config | 0 |
| documented_execution_policy | 100 ✅ |
| agent_permission_policy | 25 |
| secret_hygiene | 75 |
| supply_chain_pinning | 25 |
| injection_hygiene | 100 ✅ |

- ✅ **documented_execution_policy (100)** — `docs/agent-execution.md` documents LINCE / devcontainer / OS-sandbox / hosted + a safe-to-run list.
- ✅ **injection_hygiene (100)** — instructions confined to trusted files.
- **secret_hygiene (75)** — `.gitignore` 100% secret coverage, value-free `.env.example`, `detect-secrets` hook; add CI secret scanning + push protection on the host (partial, Med).
- **committed_isolation_config (0)** — add a `.devcontainer/` with a default-deny egress allowlist (partial, Med).
- **agent_permission_policy (25, target)** — author restrictive `.claude/settings.json` deny rules per threat model (manual, Med).
- **supply_chain_pinning (25)** — commit a lockfile + add Dependabot once dependencies exist (partial, Low).

### 7. Spec-Driven Workflow & Docs — raw 33.75, weighted 3.4/10
| Sub-criterion | Score |
|---|---|
| spec_tasks_dir | 50 |
| acceptance_criteria | 75 |
| issue_pr_templates | 0 |
| adr_decisions | 0 |
| docs_comprehension_signals | 25 |

- **acceptance_criteria (75)** — `specs/TEMPLATE.md` ships an acceptance-criteria checklist (partial, Med).
- **spec_tasks_dir (50)** — `specs/` + template present; write real delta-scoped specs per change (skill, Low).
- **issue_pr_templates (0)** / **adr_decisions (0)** — scaffold via `/agent-ready fix spec_driven_workflow_docs` (skill/partial, Low–Med).
- **docs_comprehension_signals (25)** — add an `ARCHITECTURE.md` + `CHANGELOG` as the project grows (partial, Med).

## 4. Remediation Roadmap

**Quick wins (skill-fixable, run after deps/code land):**
- `/agent-ready fix cicd_automation_governance` → real CI commands, CODEOWNERS, Dependabot, stack lint config.
- `/agent-ready fix testing_feedback` → document real test commands once a runner exists.
- `/agent-ready fix spec_driven_workflow_docs` → issue/PR templates, ADR dir.
- `/agent-ready fix agent_tooling_capabilities` → baseline `.mcp.json`.

**Manual / project-growth levers (in order):**
1. Pick the stack → add a manifest + **commit the lockfile** (unlocks supply-chain pinning + dependency clarity).
2. Add a root `README.md` and fill the AGENTS.md overview + real build/test/lint commands.
3. Write tests + a type-checker config (the single highest-impact dimension).
4. Wire a nav MCP server (Serena) and add a `.devcontainer/` with an egress allowlist.
5. Re-run `/agent-ready scan` to track progress against this baseline.

> Note: most zeros above are **expected-empty for greenfield**, not regressions — they
> become actionable as the codebase materializes.

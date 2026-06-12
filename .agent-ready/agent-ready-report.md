# Agentic Readiness Report — agents-dashboard (ccusage)

**Date**: 2026-06-12 · **Mode**: brownfield · **Agents**: portable (none declared)  
**Script signals**: available (Python 3.14.4, all 7 helper scripts ran)

---

## 1. Executive Summary

**Overall Score: 76/100 🟢 Ready**

```
Agent Instructions & Context      ███████████████░  17.2/18
Navigability & Code Intelligence  █████████████░░░  15.1/18
Testing & Feedback                ████████████░░░░  12.2/16
CI/CD, Automation & Governance    ████████████░░░░  10.5/14
Agent Tooling & Capabilities      ███████░░░░░░░░░   5.7/12
Security & Sandbox                ███████████░░░░░   8.7/12
Spec-Driven Workflow & Docs       ██████████░░░░░░   6.3/10
```

**Top 5 gaps by impact:**

1. 🔧 Agent Tooling › `standard_skills` (+6.3 pts) — No project Skills (SKILL.md). Fix: `/agent-ready fix agent_tooling_capabilities`.
2. 🧪 Testing › `fast_feedback_loop` + `coverage_reasonable` (+3.8 pts combined) — No coverage config; no documented watch mode.
3. 📋 Spec/Docs › `issue_pr_templates` (+1.5 pts) — No GitHub issue/PR templates. Fix: `/agent-ready fix spec_driven_workflow_docs`.
4. ⚙️ CI/CD › `governance` (+3.5 pts) — No CODEOWNERS or Dependabot. Fix: `/agent-ready fix cicd_automation_governance`.
5. 🔒 Security › `committed_isolation_config` (+3.4 pts) — No `.devcontainer/`. Fix: `/agent-ready fix security_sandbox`.

---

## 2. Layer Analysis

| Layer | Score | Max |
|-------|-------|-----|
| **Portable** | 76 | 100 |
| **Target-specific** | — | — (no agents declared) |

All three target sub-criteria (`cross_agent_bridge`, `custom_commands`, `agent_permission_policy`) are marked **na** and excluded from denominators. A portable repo is not penalized for vendor artifacts it doesn't need.

> **Note**: CLAUDE.md is a symlink → AGENTS.md (ideal bridge pattern). Run with `--agents claude` to score `cross_agent_bridge` (would be 100).

---

## 3. Per-Dimension Detail

### Dimension 1: Agent Instructions & Context — 95.6/100 (17.2/18) ✅

| Sub-criterion | Score |
|---|---|
| `primary_instruction_file` | ✅ 100 |
| `instruction_quality` | ✅ 100 |
| `instruction_conciseness` | ✅ 100 |
| `hierarchical_instructions` | 🟡 75 |
| `cross_agent_bridge` | — na |

**Affirmations**: AGENTS.md is 67 lines, 600 tokens, zero boilerplate. Covers project overview, exact command table, structure, code-style, verification criteria, safe-to-run section, link to agent-execution.md. CLAUDE.md → AGENTS.md symlink is the correct bridge.

#### `hierarchical_instructions` — 75
- **Evidence**: Single-package repo; root AGENTS.md covers all areas.
- **Why it matters**: Per-package scoped files deliver higher signal-to-token ratio in large repos.
- **Consequence**: Low risk at current size. Becomes important when packages are added.
- **Fix**: Not urgent. Scaffold scoped AGENTS.md stubs if subpackages are added. Effort: Med.

---

### Dimension 2: Navigability & Code Intelligence — 83.75/100 (15.1/18) 🟢

| Sub-criterion | Score |
|---|---|
| `repo_map_availability` | 🟡 75 |
| `semantic_nav_amenability` | ✅ 100 |
| `dependency_structure_clarity` | ✅ 100 |
| `readme_overview` | ✅ 100 |
| `machine_readable_contracts` | 🔴 25 |
| `file_size_sanity` | ✅ 100 |

**Affirmations**: TypeScript strict mode + Serena MCP wired. package.json with minimal deps. README is 138 lines of quality content. All TypeScript source files under 500 LOC.

#### `repo_map_availability` — 75
- **Evidence**: `repo_map.py` ran successfully (23 files, 34 edges). `docs/ARCHITECTURE.md` provides a module map. No committed symbol-index artifact.
- **Fix** (partial): `/agent-ready fix navigability_code_intelligence` — commit the `repo_map.py` output as `.agent-ready/repo-map.md`. Effort: Low.

#### `machine_readable_contracts` — 25
- **Evidence**: No OpenAPI/Protobuf/GraphQL. `/api/usage` and `/api/current-usage` have no formal contract.
- **Consequence**: Agents must infer request/response shapes from source code.
- **Fix** (manual): Author an OpenAPI spec for both endpoints. Low urgency for a local tool. Effort: High.

---

### Dimension 3: Testing & Feedback — 76.25/100 (12.2/16) 🟢

| Sub-criterion | Score |
|---|---|
| `test_suite_present` | ✅ 100 |
| `test_commands_documented` | ✅ 100 |
| `fast_feedback_loop` | 🟡 50 |
| `feedback_quality` | 🟡 75 |
| `coverage_reasonable` | 🟡 50 |

**Affirmations**: 9 test files covering all src/ modules. `bun test` documented in AGENTS.md, package.json, and CI.

#### `fast_feedback_loop` — 50
- **Evidence**: No documented watch mode or per-file filter. Full suite is fast in practice (<1s) but this is implicit, not documented.
- **Fix** (partial): Add to AGENTS.md: `bun test --watch` for interactive dev; `bun test test/<file>.test.ts` for module-targeted runs. Effort: Med.

#### `feedback_quality` — 75
- **Evidence**: `strict:true` + `noUncheckedIndexedAccess:true` configured. Descriptive test matchers. `jsdoc_block_count: 3` (minimal).
- **Fix** (partial): Add JSDoc to exported functions in `src/types.ts`, `src/aggregate.ts`, `src/ranges.ts`. Effort: Med.

#### `coverage_reasonable` — 50
- **Evidence**: No coverage config. All modules have tests but coverage is unmeasured.
- **Fix** (partial): `/agent-ready fix testing_feedback` — scaffold coverage config; add threshold in CI (e.g., `bun test --coverage`). Effort: Med.

---

### Dimension 4: CI/CD, Automation & Governance — 75.0/100 (10.5/14) 🟢

| Sub-criterion | Score |
|---|---|
| `ci_runs_tests_lint` | ✅ 100 |
| `lint_format_automated` | ✅ 100 |
| `pre_commit_hooks` | ✅ 100 |
| `governance` | 🔴 0 |

**Affirmations**: CI runs lint+typecheck+test with `--frozen-lockfile`. Biome configured and wired. Two-layer pre-commit: `.pre-commit-config.yaml` (detect-secrets, whitespace, YAML) + `.githooks/pre-commit` (usage:self).

#### `governance` — 0
- **Evidence**: No CODEOWNERS. No dependabot.yml or renovate.json.
- **Consequence**: Agent PRs lack clear reviewers; `chart.js`, `@biomejs/biome`, `typescript` accumulate unchecked updates (also a supply_chain_pinning partial gap).
- **Fix** (skill): `/agent-ready fix cicd_automation_governance` — generates CODEOWNERS + Dependabot config. Resolves both gaps simultaneously. Effort: Low.

---

### Dimension 5: Agent Tooling & Capabilities — 47.2/100 (5.7/12) 🟡

| Sub-criterion | Score |
|---|---|
| `standard_skills` | 🔴 0 |
| `bundled_helper_scripts` | 🔴 25 |
| `mcp_declaration` | 🟡 75 |
| `nav_comprehension_mcp_servers` | ✅ 100 |
| `custom_commands` | — na |

**Affirmations**: Serena is wired in `.mcp.json` and enabled in `.claude/settings.local.json`. README documents the integration.

#### `standard_skills` — 0
- **Evidence**: No SKILL.md anywhere in the project repo. `.superpowers/` is gitignored (local only).
- **Consequence**: Recurring workflows live only in ad-hoc prompts — no reusable capability layer committed to the repo.
- **Fix** (partial): `/agent-ready fix agent_tooling_capabilities` — scaffold SKILL.md. Author project-specific skills (e.g., `run-dashboard`, `add-tool-support`). **Highest-impact single gap (+6.3 pts)**. Effort: Med.

#### `bundled_helper_scripts` — 25
- **Evidence**: `scripts/usage-self.ts` exists as a project utility; no Skills-supporting context-efficient helper scripts.
- **Fix** (partial): Pair with Skills work — ship a `scripts/` dir alongside SKILL.md. Effort: Med.

#### `mcp_declaration` — 75
- **Evidence**: `.mcp.json` with Serena via uvx. Portability caveat: `uv` must be installed; fetches from GitHub on first launch.
- **Fix**: Consider pinning the Serena version (`--from git+...@<tag>`). Effort: Low.

---

### Dimension 6: Security & Sandbox — 72.1/100 (8.7/12) 🟢

| Sub-criterion | Score |
|---|---|
| `committed_isolation_config` | 🔴 0 |
| `documented_execution_policy` | ✅ 100 |
| `agent_permission_policy` | — na |
| `secret_hygiene` | ✅ 100 |
| `supply_chain_pinning` | 🟡 75 |
| `injection_hygiene` | ✅ 100 |

**Affirmations**: `docs/agent-execution.md` is excellent — vendor-neutral, covers LINCE/devcontainer/OS-sandbox/hosted, safe-to-run list, require-approval list, secrets policy. Secret hygiene is perfect (100% gitignore coverage, values-free .env.example, detect-secrets in pre-commit, 0 committed secrets). No injection-risk content in agent-read docs.

#### `committed_isolation_config` — 0
- **Evidence**: No `.devcontainer/` or other committed sandbox config.
- **Consequence**: Each contributor runs agents with inconsistent (often no) isolation; the excellent `agent-execution.md` policy is advisory only.
- **Fix** (partial): `/agent-ready fix security_sandbox` — scaffolds `.devcontainer/devcontainer.json` with default-deny egress allowlist. Hardening to true isolation is a human security decision. Effort: Med.

#### `supply_chain_pinning` — 75
- **Evidence**: `bun.lock` committed, CI uses `--frozen-lockfile`. No Dependabot/Renovate.
- **Fix**: Address via governance fix — Dependabot config covers both gaps simultaneously. Effort: Low.

---

### Dimension 7: Spec-Driven Workflow & Docs — 62.5/100 (6.25/10) 🟡

| Sub-criterion | Score |
|---|---|
| `spec_tasks_dir` | 🟡 75 |
| `acceptance_criteria` | 🟡 50 |
| `issue_pr_templates` | 🔴 0 |
| `adr_decisions` | ✅ 100 |
| `docs_comprehension_signals` | 🟡 75 |

**Affirmations**: `docs/adr/` has 3 well-formed ADRs (Context/Decision/Consequences) capturing all major design decisions. `docs/ARCHITECTURE.md` has data-flow diagram and module descriptions.

#### `spec_tasks_dir` — 75
- **Evidence**: `specs/` with `001-current-usage-box.md` (detailed delta-scoped spec) and `TEMPLATE.md`. 1 real spec.
- **Fix**: Write a spec per new feature/change using the template. Effort: Low.

#### `acceptance_criteria` — 50
- **Evidence**: Spec defines Scope (in/out) + derivation rules but has no explicit "Acceptance Criteria" checklist section.
- **Fix** (partial): Add `## Acceptance Criteria` section to `specs/TEMPLATE.md` listing checkable conditions. Effort: Med.

#### `issue_pr_templates` — 0
- **Evidence**: No `.github/ISSUE_TEMPLATE/` or `pull_request_template.md`.
- **Consequence**: Agent-generated PRs and issues arrive with inconsistent context; reviews lack a quality checklist.
- **Fix** (skill): `/agent-ready fix spec_driven_workflow_docs` — generates issue templates + PR template. Effort: Low.

#### `docs_comprehension_signals` — 75
- **Evidence**: ARCHITECTURE.md + 3 ADRs. No CHANGELOG. `jsdoc_block_count: 3` (minimal).
- **Fix** (partial): Add `CHANGELOG.md`; add JSDoc to public exports. Effort: Med.

---

## 4. Remediation Roadmap

### Quick wins — Low effort, high impact

| Priority | Gap | Points | Command |
|---|---|---|---|
| 1 | `governance` (CODEOWNERS + Dependabot) | +3.5 | `/agent-ready fix cicd_automation_governance` |
| 2 | `issue_pr_templates` | +1.5 | `/agent-ready fix spec_driven_workflow_docs` |
| 3 | `committed_isolation_config` (.devcontainer scaffold) | +3.4 | `/agent-ready fix security_sandbox` |

### Medium effort — skill-scaffolded or manual

| Priority | Gap | Points | Steps |
|---|---|---|---|
| 1 | `standard_skills` | +6.3 | Scaffold SKILL.md; write `run-dashboard` and `add-tool-support` skills |
| 2 | `coverage_reasonable` | +1.6 | Add `bun test --coverage` + CI threshold |
| 3 | `fast_feedback_loop` | +1.2 | Document `bun test --watch` + per-file filter in AGENTS.md |
| 4 | `feedback_quality` | +0.9 | Add JSDoc to exported types and functions |
| 5 | `acceptance_criteria` | +1.5 | Add AC section to TEMPLATE.md |
| 6 | `docs_comprehension_signals` | +0.9 | Add CHANGELOG.md |

### High effort — architectural

| Gap | Notes |
|---|---|
| `machine_readable_contracts` | Add OpenAPI spec for `/api/usage` + `/api/current-usage`. Low urgency for a local tool. |
| `committed_isolation_config` (hardening) | `.devcontainer/` scaffold is Med; true egress allowlist + resource limits is High. |

### Brownfield path

1. **Quick wins first** (governance, templates, devcontainer scaffold) — committed artifacts, zero risk
2. **Skills layer** — scaffold one or two project-specific Skills; bundle repo_map generation as a helper
3. **Test coverage config** — add threshold, enforce in CI
4. **CHANGELOG + JSDoc** — improve agent comprehension of historical changes and public APIs
5. **OpenAPI contracts** — defer until the API stabilizes or external consumers emerge

---

*Run `/agent-ready fix` to auto-generate skill-fixable items.*  
*Machine-readable scores: `.agent-ready/agent-ready-scores.json`*

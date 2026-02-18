---
title: feat: Internal skills CLI Phase 1 (Git-only parity)
type: feat
status: completed
date: 2026-02-17
---

# feat: Internal skills CLI Phase 1 (Git-only parity)

## Enhancement Summary

**Deepened on:** 2026-02-17  
**Sections enhanced:** 7  
**Skills applied:** `architecture-strategist`, `security-sentinel`, `security-best-practices`, `performance-oracle`, `pattern-recognition-specialist`, `kieran-typescript-reviewer`, `framework-docs-researcher`, `best-practices-researcher`

### Key Improvements
1. Added safer Git execution patterns (`spawn`/`execFile`, no shell interpolation, strict ref verification).
2. Added install-state hardening (atomic manifest writes, rollback-safe update flow, lock semantics).
3. Added stronger quality gates (parity matrix, failure injection, policy enforcement tests).

### New Considerations Discovered
- Keep CLI surface parity with upstream but preserve internal policy defaults (`copy` mode, allowlist-first).
- Use `git ls-remote --refs --exit-code` + pinned commit verification for robust update/check semantics.
- Prefer shallow/filtered/sparse clone patterns to reduce IO and latency.

## Overview
Ship internal `skills` CLI with upstream command parity for:
- `add`, `list|ls`, `find`, `remove`, `check`, `update`, `init`

Phase 1 scope:
- Source types: Git URL + Git subpath only
- Install mode default: `copy`
- Targets: Roo Code, GitHub Copilot, Claude Code
- Security baseline: allowlisted Git domains + pinned commit SHA + path safety checks
- Deferred to Phase 2: registry API, JFrog artifacts, web directory

## Problem Statement / Motivation
Teams need one internal, reliable way to install reusable skills across assistants with governance guardrails. Current PRD target (`PRD.md:1`) is broad; Phase 1 narrows to highest-value path: reliable Git installs with strict checks.

## Consolidated Research

### Internal Research
- Relevant brainstorm found: `docs/brainstorms/2026-02-17-skills-cli-phase1-brainstorm.md:1`
- Product context from `PRD.md:1`
- No existing implementation code patterns in repo (current repo is planning-only)
- No institutional learnings found (`docs/solutions/` not present)

### External Research
- Upstream command surface and options confirmed from vercel-labs/skills README and package metadata.
- Upstream supports `add/list/find/remove/check/update/init`; `add-skill` is deprecated alias.
- Official Git docs confirm primitives needed for safe implementation:
  - `git clone` shallow/filter/sparse/reject-shallow options
  - `git rev-parse --verify` for SHA validation
  - `git ls-remote --exit-code` for remote ref existence checks
  - `git sparse-checkout` for subpath-focused extraction

### Section Manifest (Deepen Pass)
- Section 1: Overview/Scope - parity + policy boundary clarity
- Section 2: Architecture/Data contracts - safer execution + state durability patterns
- Section 3: SpecFlow - additional unhappy paths and concurrency handling
- Section 4: Technical considerations - security/performance controls from docs
- Section 5: Implementation phases - delivery gates + rollback strategy
- Section 6: Acceptance criteria - measurable pass/fail behavior
- Section 7: Risks/metrics - operational reliability and drift controls

### Discovery Results
- Skills discovered: global skill set available under `~/.codex/skills/` (used relevant subset above).
- Review agents discovered: none in `.codex/agents/`, `~/.codex/agents/`, or plugin cache paths.
- Institutional learnings discovered: none (`docs/solutions/` absent).

## Scope and Assumptions
- This plan prioritizes upstream behavior parity over stale path conventions in the PRD when they conflict.
- Agent install paths (Phase 1):
  - Roo Code: `.roo/skills/` and `~/.roo/skills/`
  - GitHub Copilot: `.agents/skills/` (project default), `.github/skills/` (project compatibility), and `~/.copilot/skills/` (user)
  - Claude Code: `.codex/skills/` and `~/.codex/skills/`
- `find` uses one internal Git-hosted catalog file (`index.json`) instead of registry API.
- Default install is `copy`; symlink can remain out-of-scope for Phase 1.

## Canonical Target Path Contract (Phase 1)

| Agent | Scope | Path | Notes |
|---|---|---|---|
| Roo Code | project | `.roo/skills/<skill>` | canonical |
| Roo Code | user | `~/.roo/skills/<skill>` | canonical |
| GitHub Copilot | project | `.agents/skills/<skill>` | default write target |
| GitHub Copilot | project | `.github/skills/<skill>` | compatibility read/write when pre-existing or `--copilot-project-path=github` |
| GitHub Copilot | user | `~/.copilot/skills/<skill>` | canonical |
| Claude Code | project | `.codex/skills/<skill>` | canonical |
| Claude Code | user | `~/.codex/skills/<skill>` | canonical |

Rules:
- `list`/`check` scan both Copilot project roots.
- `remove` only mutates managed entries recorded in manifest (`managed_root`).
- New installs default to Copilot `.agents/skills/` unless compatibility rule selects `.github/skills/`.

## Proposed Solution

### Architecture
1. CLI layer
- Parse commands/options, print help, normalize errors.
- Candidate files:
  - `src/cli.ts`
  - `src/commands/{add,list,find,remove,check,update,init}.ts`

2. Source resolver
- Parse Git URL / subpath input, normalize repository + ref + subpath.
- Candidate files:
  - `src/source/parse-source.ts`
  - `src/source/git-resolver.ts`

3. Git fetcher + cache
- Clone/fetch into cache, pin to commit SHA, extract requested paths.
- Candidate files:
  - `src/git/git-client.ts`
  - `src/git/cache.ts`

4. Skill discovery + validation
- Discover `SKILL.md`, parse frontmatter, enforce schema and folder naming rules.
- Candidate files:
  - `src/skills/discovery.ts`
  - `src/skills/validate.ts`

5. Installer
- Copy validated skill folders to target assistant directories for project/global scope.
- Candidate files:
  - `src/install/targets.ts`
  - `src/install/copier.ts`

6. State + update engine
- Persist install metadata (source, commit, path, installed targets, timestamps).
- Candidate files:
  - `src/state/install-manifest.ts`
  - `src/commands/{check,update}.ts`

7. Catalog search (`find`)
- Pull/read internal Git `index.json`; provide keyword search.
- Candidate files:
  - `src/catalog/index-provider.ts`
  - `src/commands/find.ts`

### Data Contracts
- Install manifest (`project` + `global`):
  - `schema_version`, `install_id`
  - `source_url`, `source_type`, `resolved_commit`, `ref`, `subpath`
  - `skill_name`, `skill_path`, `agent`, `scope`, `managed_root`
  - `installed_at`, `created_at`, `updated_at`
  - `checksum` (optional in Phase 1)
- Catalog index (`index.json`):
  - `name`, `description`, `tags`, `source_url`, `default_ref`, `path`, `owner_team`

Manifest v1 invariants:
- `schema_version` required and equals `1` for Phase 1.
- `install_id` stable UUID per installed skill target tuple.
- `managed_root` required to prevent destructive `remove` across unmanaged dirs.

### Research Insights

**Best Practices:**
- Add command-safe process wrapper: pass args as array, disable shell, sanitize/normalize refs and paths before invocation.
- Keep parser, fetcher, installer, and state as separate modules; avoid coupling command handlers to filesystem internals.
- Maintain one canonical manifest schema version from day 1 with migration hook stub.

**Performance Considerations:**
- Default Git fetch path should prefer `--depth 1` and `--single-branch`; use sparse checkout only when subpath requested.
- Use cache key = `repo_url + ref_or_commit + subpath` to avoid redundant fetches.
- Keep `find` catalog cache with short TTL to reduce repeated network calls.

**Implementation Details:**
```ts
// src/git/run-git.ts
import { spawn } from 'node:child_process';

export function runGit(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd, stdio: 'pipe', shell: false });
    let err = '';
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim()))));
  });
}
```

```ts
// src/state/install-manifest.ts
// Write to temp then rename for atomic update.
```

**Edge Cases:**
- `update` when tracked branch deleted: keep current install, mark status `orphaned_ref`.
- `check` on unreachable remote: report `unreachable` not `outdated`.
- Concurrent `add`/`remove` on same skill: serialize via lock file in manifest directory.
- Catalog unavailable: `find` falls back to stale cache + explicit warning.

**References:**
- Upstream CLI/source patterns in `vercel-labs/skills` (`src/cli.ts`, `src/add.ts`, `src/skill-lock.ts`, `src/git.ts`)
- Node child process docs (shell injection warning)
- Git clone/ls-remote/rev-parse docs

## SpecFlow Analysis

### User Flow Overview
1. `skills init [name]`
- create local skill template with valid frontmatter.

2. `skills add <source>`
- parse source -> enforce domain allowlist -> resolve/pin commit -> discover skills -> validate -> copy install -> record manifest.

3. `skills list|ls`
- read manifest + filesystem state -> print installed skills by scope/agent.

4. `skills find [query]`
- fetch/read internal Git catalog -> filter by query/tags -> return install-ready entries.

5. `skills check`
- validate install structure + policy + remote commit/reference reachability.

6. `skills update`
- detect newer commit (tracked ref) -> reinstall safely -> update manifest.

7. `skills remove`
- remove selected/all skills by scope/agent; prune manifest entries.

### Flow Permutations Matrix

| Flow | Scope | Agent Selection | Source Variant | Expected Behavior |
|---|---|---|---|---|
| add | project/global | single/multi | Git repo URL | installs selected/all skills |
| add | project/global | single/multi | Git subpath URL | installs only matching path skills |
| remove | project/global | single/multi/all | n/a | removes files + manifest rows |
| check | project/global | single/multi/all | manifest source | reports valid/outdated/policy failures |
| update | project/global | single/multi/all | manifest source | applies only outdated entries |

### Gaps Found and Resolutions to Carry Into Plan
- Path convention mismatch (PRD vs upstream): resolved by following upstream path mapping for selected agents.
- `find` without registry: resolved with internal Git `index.json` catalog.
- `check` depth unclear: resolved with strict policy checks included in Phase 1.
- Update semantics unclear for pinned SHA: resolved by storing original ref + pinned commit, then checking ref movement during `update`.

### Critical Questions
- None blocking. Assumptions above are explicit and testable.

### Additional Edge-Flow Checks
- `skills add` with private repo auth failure must return actionable next steps (SSH/HTTPS auth hints).
- `skills remove --all` must not delete unmanaged directories.
- `skills init` must fail fast on invalid names or existing path collisions.
- `skills update` must be no-op when remote ref head == installed commit.

## Technical Considerations
- Reliability:
  - deterministic installs from pinned commits
  - idempotent re-runs of `add`/`update`
- Security:
  - enforce Git domain allowlist
  - require/record commit SHA pin
  - path traversal and unsafe filename rejection
  - block dangerous file types per PRD policy
- Performance:
  - shallow/focused Git fetch and local cache reuse
- UX parity:
  - preserve upstream command names and familiar flags where feasible

### Research Insights

**Best Practices:**
- Security-first command execution: no shell mode for Git commands; treat all source/ref/subpath inputs as untrusted.
- Verify refs with `git rev-parse --verify --end-of-options` semantics before install state mutation.
- Keep policy checks centralized (`domain allowlist`, `path safety`, `blocked file types`) to prevent command-specific drift.

**Performance Considerations:**
- Prefer shallow clone + filtered blobs where compatible; benchmark fallback path for hosts without partial clone support.
- Avoid full repo scans when subpath is known.
- Batch filesystem existence checks in list/check flows.

**Implementation Details:**
- Fail closed on policy errors before any clone work.
- Use staged temp install dir and final rename/copy only after validation success.
- Keep structured status codes in check/update (`valid`, `outdated`, `policy_violation`, `unreachable`, `orphaned_ref`).

**Edge Cases:**
- Windows path separators in subpath parsing.
- Shallow remote handling when source is itself shallow.
- Ref ambiguity between branch/tag names.

## Implementation Phases

### Phase 1: Foundation
- [x] Scaffold CLI command surface and help output in `src/cli.ts`
- [x] Implement source parsing + Git URL/subpath normalization in `src/source/parse-source.ts`
- [x] Implement allowlist policy config in `src/policy/domain-allowlist.ts`
- [x] Implement install manifest read/write in `src/state/install-manifest.ts`
- [x] Add manifest schema version + migration stub in `src/state/manifest-schema.ts`
- [x] Add command-safe git runner in `src/git/run-git.ts`
- [x] Add canonical target-path contract doc in `docs/contracts/install-targets.md`
- [x] Add ADR documenting Phase 1 CLI/path contract divergence from PRD in `docs/adr/0001-phase1-cli-contract.md`

### Phase 2: Core Commands
- [x] Implement `add` with pinned commit resolution in `src/commands/add.ts`
- [x] Implement copy installer and target mapping in `src/install/targets.ts`
- [x] Implement `list|ls` in `src/commands/list.ts`
- [x] Implement `remove` in `src/commands/remove.ts`
- [x] Implement `init` template generator in `src/commands/init.ts`
- [x] Add install transaction flow (temp dir -> validate -> commit) in `src/install/transaction.ts`
- [x] Add skill name/path sanitization guardrails in `src/skills/validate.ts`
- [x] Implement Copilot project path compatibility selector (`.agents` default, `.github` compatibility)

### Phase 3: Discovery + Maintenance
- [x] Implement `find` against internal Git `index.json` in `src/commands/find.ts`
- [x] Implement `check` validation pipeline in `src/commands/check.ts`
- [x] Implement `update` with safe reinstall flow in `src/commands/update.ts`
- [x] Add end-to-end command tests in `test/e2e/*.test.ts`
- [x] Add stale catalog fallback cache in `src/catalog/cache.ts`
- [x] Add status-code snapshot tests for `check`/`update` in `test/contract/check-update.test.ts`

### Phase 4: Hardening
- [x] Add failure-mode tests (network/auth/path traversal) in `test/security/*.test.ts`
- [x] Add telemetry/audit event hooks in `src/audit/events.ts`
- [x] Document operator runbook in `docs/runbooks/skills-cli-phase1.md`
- [x] Add concurrent command lock tests in `test/concurrency/*.test.ts`
- [x] Add rollback simulation tests in `test/reliability/rollback.test.ts`
- [x] Add target-path smoke tests (all agents, project+user) in `test/e2e/targets-smoke.test.ts`

### Phase Gates
- Gate A (after Phase 1): parser + policy + manifest tests all green.
- Gate B (after Phase 2): `add/list/remove/init` parity tests green across project/global scope.
- Gate C (after Phase 3): `find/check/update` contract tests and stale-catalog fallback verified.
- Gate D (after Phase 4): failure injection + concurrency + rollback suite green.

## Alternative Approaches Considered
1. Full platform now (registry + JFrog + web)
- Rejected for Phase 1 due delivery risk and longer lead time.

2. Manifest-first repo onboarding
- Useful later, but unnecessary for first reliability milestone.

3. Adapter-heavy architecture now
- Deferred to avoid early abstraction cost (YAGNI).

## Acceptance Criteria

### Functional Requirements
- [ ] CLI binary name is `skills`.
- [ ] Optional compatibility alias `add-skill` is either implemented or explicitly documented as unsupported.
- [ ] `add/list/find/remove/check/update/init` commands exist and work for Git-only scope.
- [ ] `add` supports Git URL + Git subpath input.
- [ ] Install targets support Roo, GitHub Copilot, Claude Code in project/global scope.
- [ ] Claude Code target paths are `.codex/skills` (project + user scopes).
- [ ] Copilot project path policy is explicit: default `.agents/skills`; compatibility `.github/skills` per contract.
- [ ] Default install mode is copy.
- [ ] `find` returns results from internal Git catalog.
- [ ] `find` degrades to cached catalog when remote index unavailable.
- [ ] `check` validates structure, policy, and source reachability.
- [ ] `update` upgrades only outdated installs and updates manifest.
- [ ] `update` leaves current install intact on fetch/install failure and reports explicit failure state.

### Non-Functional Requirements
- [ ] Deterministic installs from pinned commit SHA.
- [ ] Domain allowlist enforcement blocks non-approved Git hosts.
- [ ] Path traversal attempts are rejected and logged.
- [ ] Command failures return actionable errors and non-zero exit codes.
- [ ] Manifest writes are atomic and crash-safe.
- [ ] Concurrent command execution does not corrupt manifest or partial-install state.
- [ ] Manifest v1 enforces `schema_version`, `install_id`, and `managed_root` for every install record.

### Quality Gates
- [ ] Unit tests for parser/validator/installer/state.
- [ ] E2E tests for all commands across at least one project + one global scope scenario.
- [ ] E2E target-path smoke tests pass for Roo/Copilot/Claude across project+user scopes.
- [ ] Security test coverage for allowlist and path safety checks.
- [ ] Contract tests for check/update status outputs.
- [ ] Failure injection tests for auth errors, network loss, and interrupted installs.

## Success Metrics
- `add` success rate >= 99% in CI test matrix.
- P50 install time <= 5s for one-skill repository (cached network case).
- 0 critical security findings in pre-release review.
- No manual post-install steps required for supported targets.
- `check` false-positive outdated rate <= 2% against controlled fixtures.
- 100% rollback success in interrupted update simulation tests.

## Dependencies & Risks

### Dependencies
- Node.js runtime (>=18 recommended to match upstream baseline)
- Git available on PATH
- Internal Git catalog repository with `index.json`
- Domain allowlist policy input (env/file)

### Risks and Mitigations
- Upstream behavior drift
  - Mitigation: parity tests vs selected upstream command semantics.
- Agent path convention churn
  - Mitigation: central target mapping table + versioned config.
- Private repo auth variability
  - Mitigation: clear auth error surface and preflight checks.
- Catalog availability/reliability
  - Mitigation: local cache TTL + stale-read fallback + clear freshness indicators.
- Manifest corruption from unexpected process termination
  - Mitigation: atomic write+rename and startup integrity check.
- Concurrent command races
  - Mitigation: lock file strategy per scope (`project`/`global`).

## Documentation Plan
- Add user docs for command usage and examples in `README.md`.
- Add admin docs for allowlist/catalog config in `docs/configuration/skills-cli.md`.
- Add troubleshooting guide in `docs/troubleshooting/skills-cli.md`.
- Add canonical target path contract in `docs/contracts/install-targets.md`.
- Add ADR for Phase 1 CLI/path contract choices in `docs/adr/0001-phase1-cli-contract.md`.

## References & Research

### Internal References
- `PRD.md:1`
- `docs/brainstorms/2026-02-17-skills-cli-phase1-brainstorm.md:1`

### External References
- Vercel Labs Skills README: https://github.com/vercel-labs/skills
- Vercel Labs Skills changelog (`add-skill` deprecation): https://github.com/vercel-labs/skills/blob/main/changelog.md
- Vercel Labs Skills package metadata: https://raw.githubusercontent.com/vercel-labs/skills/main/package.json
- Vercel Labs Skills CLI source: https://github.com/vercel-labs/skills/blob/main/src/cli.ts
- Vercel Labs Skills add flow: https://github.com/vercel-labs/skills/blob/main/src/add.ts
- Vercel Labs Skills lockfile model: https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts
- Vercel Labs Skills git wrapper: https://github.com/vercel-labs/skills/blob/main/src/git.ts
- Node.js child_process docs: https://nodejs.org/api/child_process.html
- Git clone docs: https://git-scm.com/docs/git-clone
- Git sparse-checkout docs: https://git-scm.com/docs/git-sparse-checkout
- Git rev-parse docs: https://git-scm.com/docs/git-rev-parse
- Git ls-remote docs: https://git-scm.com/docs/git-ls-remote

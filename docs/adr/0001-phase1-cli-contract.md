# ADR 0001: Phase 1 CLI and Path Contract

**Date:** 2026-02-17
**Status:** Accepted

## Context

The PRD (`PRD.md`) was written before upstream `vercel-labs/skills` conventions were fully established internally. Several decisions in the PRD conflict with what upstream shipped. This ADR documents each divergence and the rationale for our choices.

## Decisions

### 1. CLI binary name: `skills` (not `corp-skills`)

**PRD:** CLI name is `corp-skills`.
**Decision:** Use `skills` to match upstream.
**Rationale:** Muscle memory and documentation portability. Teams familiar with the public `skills` CLI can use the same command name internally. The binary can be aliased if needed.

### 2. Copilot project install path: `.agents/skills/` default

**PRD:** Copilot project path is `.github/skills/<skill>`.
**Decision:** Default to `.agents/skills/<skill>`; use `.github/skills/<skill>` only when that directory pre-exists.
**Rationale:** Upstream defaults to `.agents/skills/` and many tools (Codex CLI, OpenCode) also resolve from `.agents/`. Adopting the same default reduces cross-tool friction. The compatibility check preserves backward compatibility for projects already using `.github/skills/`.

### 3. Claude Code target paths: `.codex/skills/` (not `.claude/skills/`)

**PRD:** Does not specify Claude Code paths.
**Decision:** Project scope: `.codex/skills/<skill>`. User scope: `~/.codex/skills/<skill>`.
**Rationale:** This matches the Codex/Claude Code convention used internally. `.codex/` is the conventional project config directory for Claude Code.

### 4. Default install mode: `copy` (not symlink)

**PRD:** Default install is symlink; copy is opt-in via `--copy`.
**Decision:** Default to copy; symlink deferred to Phase 2.
**Rationale:** Symlinks require elevated permissions on Windows and fail silently in some CI environments. Copy mode is deterministic and portable. Symlink support can be added in Phase 2 when there is a concrete consumer requirement.

### 5. Source types: Git only (no JFrog, no registry shortcut)

**PRD:** Phase 1 includes JFrog artifact installs and registry shortcuts.
**Decision:** Phase 1 supports Git URL and Git subpath only.
**Rationale:** Git-based installs cover the highest-value path and ship fastest. JFrog integration requires artifact signing infrastructure not yet in place. Registry shortcuts require a running registry API. Both are deferred to Phase 2.

### 6. `find` source: internal Git `index.json` (not registry API)

**PRD:** `find`/`search` queries the registry API.
**Decision:** `find` fetches a Git-hosted `index.json` catalog. Falls back to local cache when remote is unavailable.
**Rationale:** No registry API exists in Phase 1. A static JSON file in a Git repo provides the same searchability with zero additional infrastructure. TTL-based caching ensures `find` is usable offline.

### 7. Command set: upstream parity (`add`, `list`/`ls`, `find`, `remove`, `check`, `update`, `init`)

**PRD:** Commands are `search`, `info`, `add`, `remove`, `list`, `publish`, `init`.
**Decision:** Match upstream: `add`, `list`/`ls`, `find`/`search`, `remove`, `check`, `update`, `init`.
**Rationale:** `publish` is deferred (no registry). `info` is covered by `find`. `check` and `update` are higher-value operational commands not in the PRD but present in upstream. `find` alias `search` preserves discoverability.

## Consequences

- Teams migrating from PRD documentation must update any references to `corp-skills` → `skills` and `.github/skills/` → `.agents/skills/`.
- Phase 2 will add symlink mode, JFrog sources, and registry shortcuts without breaking the Phase 1 interface.
- The `managed_root` field in the manifest ensures `remove` is always safe regardless of which Copilot path was used at install time.

---
date: 2026-02-17
topic: skills-cli-phase1-git-only
---

# Skills CLI Phase 1 (Git-Only)

## What We're Building
Build internal CLI named `skills` that mirrors vercel-labs `skills` command experience, but Phase 1 is Git-only installs. Primary success target is install reliability: user runs install command and gets a working skill fast.

Phase 1 supports source resolution from Git URL and Git subpath only. Install targets are Roo Code, GitHub Copilot, and Claude Code, each with user + project scope paths.

## Why This Approach
We choose direct-install CLI first (no registry/JFrog/web in Phase 1). This is smallest scope with highest chance to ship fast and stable. It preserves future expansion while avoiding early platform complexity.

## Key Decisions
- CLI name: `skills` (rename from `corp-skills`).
- Phase 1 success metric: install reliability.
- Source scope: Git URL + Git subpath only.
- Install targets: Roo + Copilot + Claude Code.
- Claude Code paths: `~/.codex/skills/<skill>` and `<repo>/.codex/skills/<skill>`.
- Install mode default: copy (not symlink).
- Security baseline: allowlisted Git domains + pinned commit SHA.
- Phase 1 defers: registry API, JFrog artifacts, web directory.
- Command set: parity with upstream `skills` commands (`add`, `list/ls`, `find`, `remove`, `check`, `update`, `init`).
- `find` catalog source: single internal Git repo `index.json`.
- `check` scope: structure validation + remote commit existence + policy checks (allowlist, SHA format, path safety).

## Resolved Questions
- `find` source without registry: use internal Git-hosted `index.json`.
- `check` strictness: include policy enforcement in Phase 1.

## Open Questions
- None.

## Next Steps
→ `/prompts:workflows-plan` for implementation details.

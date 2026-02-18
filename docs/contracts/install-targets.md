# Install Target Path Contract (Phase 1)

This document defines the canonical install paths for all supported agents and scopes.
Code in `src/install/targets.ts` implements this contract.

## Path Table

| Agent | Scope | Canonical Path | Notes |
|---|---|---|---|
| `roo` | project | `.roo/skills/<skill-name>` | Relative to project root (cwd) |
| `roo` | user | `~/.roo/skills/<skill-name>` | User home directory |
| `copilot` | project | `.agents/skills/<skill-name>` | Default write target |
| `copilot` | project | `.github/skills/<skill-name>` | Compatibility: used when `.github/skills/` pre-exists |
| `copilot` | user | `~/.copilot/skills/<skill-name>` | User home directory |
| `claude-code` | project | `.claude/skills/<skill-name>` | Relative to project root (cwd) |
| `claude-code` | user | `~/.claude/skills/<skill-name>` | User home directory |

## Rules

### Copilot Project Path Selection

New installs default to `.agents/skills/`. If `.github/skills/` already exists in the project root at install time, `.github/skills/` is used instead for backward compatibility.

`list` and `check` commands scan **both** Copilot project roots.

`remove` only deletes paths recorded in the manifest `managed_root` field. It never touches unmanaged directories.

### Scope

- `project` scope: path is relative to `process.cwd()` at the time of install.
- `user` scope: path is under `$HOME` (or `$USERPROFILE` on Windows).

### Managed Root

Every manifest entry records a `managed_root` field containing the absolute path that was installed. `remove` uses this field exclusively to locate and delete files, preventing accidental deletion of unmanaged directories.

### Skill Name Safety

Skill directory names must match `[a-z0-9_-]+` and must not begin with `-` or `_`. Path traversal sequences (`..`) and absolute paths are rejected before any filesystem operation.

## Divergence from PRD

The PRD (`PRD.md:128`) specified `.github/skills/` as the sole Copilot project path. This plan follows the upstream `vercel-labs/skills` convention instead:

- Default write target: `.agents/skills/`
- Compatibility read/write: `.github/skills/` (when pre-existing)

This divergence is documented in `docs/adr/0001-phase1-cli-contract.md`.

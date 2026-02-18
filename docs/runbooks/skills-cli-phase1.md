# Operator Runbook: skills CLI (Phase 1)

## Overview

The `skills` CLI installs reusable AI agent skills from Git repositories into Roo Code, GitHub Copilot, and Claude Code. This runbook covers configuration, troubleshooting, and operational tasks.

---

## Configuration

### Domain Allowlist

By default, the following Git hosts are allowed:

- `github.com`
- `gitlab.com`
- `bitbucket.org`

To add internal Git hosts, set `SKILLS_ALLOWED_DOMAINS`:

```bash
export SKILLS_ALLOWED_DOMAINS="github.com,gitlab.com,bitbucket.org,git.corp.internal"
```

Values are comma-separated. Setting this variable **replaces** the default list entirely, so include all required domains.

### Cache Directory

Git clones are cached at `~/.cache/skills/git/` by default.

Override with:

```bash
export SKILLS_CACHE_DIR=/path/to/custom/cache
```

### Skills Catalog

For `skills find` to work, set the URL of your internal Git catalog repository:

```bash
export SKILLS_CATALOG_URL=https://git.corp.internal/platform/skills-catalog
```

The repository must contain an `index.json` at the root with entries:

```json
[
  {
    "name": "my-skill",
    "description": "What it does",
    "tags": ["frontend", "typescript"],
    "source_url": "https://git.corp.internal/org/repo",
    "default_ref": "main",
    "path": "skills/my-skill",
    "owner_team": "platform"
  }
]
```

Catalog entries are cached locally for 5 minutes. `find` degrades gracefully to stale cache when the remote is unreachable.

### Audit Log

To write structured audit events to a file:

```bash
export SKILLS_AUDIT_LOG=/var/log/skills/audit.log
```

Each line is a JSON object:

```json
{"type":"skill.add","timestamp":"2026-02-17T10:00:00.000Z","data":{"skill":"my-skill","agent":"roo"}}
```

---

## Common Operations

### Install a skill from a Git repo

```bash
# Install all skills from a repo (project scope, all agents)
skills add https://github.com/org/repo

# Install a specific skill to a specific agent
skills add org/repo --skill my-skill --agent claude-code

# Install globally (user scope)
skills add org/repo --global

# Install from a subpath
skills add https://github.com/org/repo/tree/main/skills/my-skill
```

### List installed skills

```bash
# Project scope
skills list

# User scope
skills list --global

# Filter by agent
skills list --agent roo
```

### Check install health

```bash
skills check
```

Status codes:

| Code | Meaning |
|------|---------|
| `valid` | Files present, policy OK, source reachable, commit matches |
| `outdated` | Remote ref has moved to a newer commit |
| `policy_violation` | Source domain no longer in allowlist |
| `unreachable` | Cannot contact remote repository |
| `orphaned_ref` | Tracked branch/tag no longer exists |
| `missing` | Files not found on disk |

Exit code is non-zero when any issues are found.

### Update outdated skills

```bash
# Update all outdated skills (project scope)
skills update

# Update globally
skills update --global
```

`update` is a no-op for skills already at the latest commit. It leaves current files intact if fetching or installing the new version fails.

### Remove skills

```bash
# Remove a specific skill from all agents
skills remove my-skill

# Remove from a specific agent
skills remove my-skill --agent copilot

# Remove all skills (project scope)
skills remove --all

# Remove all skills (user scope)
skills remove --all --global
```

`remove` only deletes files that were installed by the CLI (tracked via `managed_root` in the manifest). It does not touch unmanaged directories.

### Create a new skill template

```bash
skills init my-new-skill
```

This creates `./my-new-skill/SKILL.md` with valid frontmatter. Edit the file and use `skills add` to install it.

---

## Manifest Location

Manifests track installed skills for safe `remove` and `update` operations.

| Scope | Path |
|-------|------|
| Project | `<cwd>/.skills-manifest.json` |
| User | `~/.config/skills/.skills-manifest.json` |

Manifest writes are atomic (write to temp file, then rename). Corruption from interrupted writes is prevented by this strategy.

If a manifest is corrupt or has an unknown schema version, it is reset to empty on next read and a fresh manifest is written on the next install.

---

## Troubleshooting

### `Domain not in allowlist`

The source URL's domain is not in `SKILLS_ALLOWED_DOMAINS`. Add it:

```bash
export SKILLS_ALLOWED_DOMAINS="github.com,your-domain.com"
```

### `Authentication failed` / `Permission denied` (during clone)

The Git host requires authentication. Configure credentials before running:

```bash
# SSH key
ssh-add ~/.ssh/id_rsa
ssh -T git@github.com  # test access

# HTTPS credential helper
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper manager       # Windows
```

### `No skills found in the source`

The repository has no `SKILL.md` files, or the specified `--skill` name doesn't match any discovered skill.

Check what's available without installing:

```bash
skills add org/repo --list  # not yet implemented in Phase 1; clone and inspect manually
```

### `check` reports `missing` but files exist

The manifest `managed_root` path doesn't match the actual file location. This can happen if the project was moved or the skill was manually relocated. Remove and re-add the skill:

```bash
skills remove my-skill
skills add <original-source>
```

### Cache stale or corrupt

Clear the Git clone cache:

```bash
rm -rf ~/.cache/skills/git/
```

Clear the catalog cache:

```bash
rm -rf ~/.cache/skills/catalog/
```

---

## Phase 2 Roadmap

- Symlink install mode (`--symlink`)
- JFrog artifact sources (`https://jfrog.corp.internal/...`)
- Registry shortcut installs (`skills add my-skill@1.2.3`)
- Registry API (`GET /skills`, `POST /publish`)
- Concurrent command locking (lock file per scope)

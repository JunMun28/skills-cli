# PRD.md

# Internal Skills CLI (Corp Skills) -- Product Requirements Document

## 1. Overview

This document defines the product requirements for building an internal
Skills CLI and registry system that replicates the functionality of
https://github.com/vercel-labs/skills, but for internal company usage.

The system will: - Allow teams to publish reusable AI Agent Skills -
Support installation into Roo Code and GitHub Copilot skill
directories - Support installation from: - Internal Git repositories -
JFrog-hosted artifacts - Provide search, versioning, validation, and
governance - Ensure enterprise-grade security and auditability

------------------------------------------------------------------------

## 2. Goals

### Primary Goals

1.  Replicate `npx skills add <source>` experience internally
2.  Support installing skills from:
    -   Git URLs (GitHub Enterprise / GitLab)
    -   JFrog Generic repository artifacts
3.  Support installing to:
    -   Roo Code (user & project scope)
    -   GitHub Copilot (user & project scope)
4.  Provide enterprise governance (review, signing, validation)
5.  Provide searchable internal website (skills.sh-style directory)

### Non-Goals (Phase 1)

-   Public marketplace exposure
-   Monetization features
-   Advanced analytics dashboards

------------------------------------------------------------------------

## 3. Target Users

-   AI Platform Engineers
-   Internal Developer Teams
-   Prompt Engineers
-   Tooling / DevEx teams

------------------------------------------------------------------------

## 4. Definitions

Skill = A folder containing: - SKILL.md (required, YAML frontmatter) -
Optional supporting files (scripts, templates, examples)

Skill Package = A Git repo or tarball containing one or more Skill
folders.

------------------------------------------------------------------------

## 5. High-Level Architecture

### Components

1.  Corp Skills CLI
2.  Skills Registry API
3.  JFrog Skills Artifact Repository
4.  Git-based Contribution Repository
5.  Skills Web Directory

------------------------------------------------------------------------

## 6. CLI Requirements

### CLI Name

`corp-skills`

### Core Commands

-   corp-skills search `<query>`{=html}
-   corp-skills info `<skill>`{=html}
-   corp-skills add `<source>`{=html} \[--skill name\] \[--scope
    user\|project\] \[--agent roo\|copilot\|both\]
-   corp-skills remove `<skill>`{=html}
-   corp-skills list
-   corp-skills publish (maintainers only)
-   corp-skills init `<skill-name>`{=html}

------------------------------------------------------------------------

## 7. Source Resolver Design

The CLI must detect source type automatically.

### Supported Sources

1.  Git URL
    -   https://internal-git/org/repo
    -   git@internal-git:org/repo.git
2.  Direct Git Subpath
    -   https://internal-git/org/repo/tree/main/skills/brainstorming
3.  JFrog Artifact URL
    -   https://jfrog.company.com/artifactory/skills/my-skill-1.2.3.tgz
4.  Registry Shortcut
    -   corp-skills add brainstorming@1.2.3

### Resolver Logic

If source is: - Git → clone shallow, extract skill folders - JFrog →
download artifact, verify checksum, extract - Registry → resolve to
artifact URL via API

------------------------------------------------------------------------

## 8. Installation Targets

### Roo Code

User Scope: \~/.roo/skills/`<skill-name>`{=html}/

Project Scope: `<repo>`{=html}/.roo/skills/`<skill-name>`{=html}/

### GitHub Copilot

User Scope: \~/.copilot/skills/`<skill-name>`{=html}/

Project Scope: `<repo>`{=html}/.github/skills/`<skill-name>`{=html}/

------------------------------------------------------------------------

## 9. Installation Mode

Default: Symlink (fast, updatable) Optional: Copy mode (--copy)

------------------------------------------------------------------------

## 10. Registry API Requirements

Endpoints:

GET /skills GET /skills/{name} GET /skills/{name}/versions GET
/skills/{name}/{version}/download POST /publish (CI only)

Registry stores: - name - version - description - tags - owner_team -
checksum - signature - compatibility (roo\|copilot\|both)

------------------------------------------------------------------------

## 11. Publishing Workflow

### Git-Based Contribution (Default)

1.  Contributor runs: corp-skills init my-skill

2.  Open PR in internal-skills repo

3.  CI Validation:

    -   Validate SKILL.md format
    -   Validate name == folder name
    -   Lint YAML
    -   Size limits
    -   Secret scan
    -   Virus scan

4.  If approved:

    -   Package as my-skill-1.0.0.tgz
    -   Generate sha256
    -   Sign artifact
    -   Upload to JFrog
    -   Update registry index

------------------------------------------------------------------------

## 12. Security Model

-   Only CI service account can deploy to JFrog skills repo
-   All artifacts signed
-   CLI verifies checksum + signature
-   Allowlist Git domains
-   Block path traversal in archives
-   Block dangerous file types (exe, dylib, so)

------------------------------------------------------------------------

## 13. Versioning Strategy

Semantic Versioning (SemVer):

MAJOR.MINOR.PATCH

Immutable versions once published.

Allow deprecate/yank via registry metadata.

------------------------------------------------------------------------

## 14. Website Requirements

Features:

-   Search by name/tags
-   View rendered SKILL.md
-   Copy install command
-   View version history
-   View owner team
-   Deprecation warnings

------------------------------------------------------------------------

## 15. Caching Strategy

CLI should:

-   Cache cloned repos in \~/.cache/corp-skills/git/
-   Cache downloaded artifacts in \~/.cache/corp-skills/artifacts/
-   Support --no-cache flag

------------------------------------------------------------------------

## 16. Telemetry (Optional)

-   Track installs (anonymized)
-   Track versions in use
-   Track deprecated skill usage

------------------------------------------------------------------------

## 17. Implementation Phases

### Phase 1 -- MVP

-   Git source install
-   JFrog artifact install
-   Roo + Copilot support
-   PR-based publishing
-   Static registry JSON index

### Phase 2 -- Governance

-   Signing enforcement
-   Registry API service
-   Deprecation system
-   Role-based publish control

### Phase 3 -- Platform Maturity

-   Web UI upload flow
-   Enterprise SSO integration
-   Usage analytics
-   Skill compatibility matrix

------------------------------------------------------------------------

## 18. Risks

-   Malicious skill content
-   Namespace collisions
-   Version drift in symlink mode
-   Agent behavior inconsistency

Mitigation: - Validation - Signing - Immutable versioning - Ownership
enforcement

------------------------------------------------------------------------

## 19. Success Metrics

-   Time to install skill \< 5 seconds

-   80% teams using shared skills

-   \<1% install failure rate

-   Zero security incidents

------------------------------------------------------------------------

## 20. Open Questions

-   GitHub Enterprise or GitLab?
-   Python or Node for CLI?
-   Default install scope?
-   Enforce org-only Git sources?
-   Require signing at MVP or Phase 2?

------------------------------------------------------------------------

End of PRD

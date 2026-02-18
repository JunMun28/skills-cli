/**
 * Canonical install target paths for each supported agent.
 *
 * | Agent          | Scope   | Path                              |
 * |----------------|---------|-----------------------------------|
 * | roo            | project | .roo/skills/<skill>               |
 * | roo            | user    | ~/.roo/skills/<skill>             |
 * | copilot        | project | .agents/skills/<skill> (default)  |
 * | copilot        | project | .github/skills/<skill> (compat)   |
 * | copilot        | user    | ~/.copilot/skills/<skill>         |
 * | claude-code    | project | .codex/skills/<skill>             |
 * | claude-code    | user    | ~/.codex/skills/<skill>           |
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';

export type AgentName = 'roo' | 'copilot' | 'claude-code';
export type Scope = 'project' | 'user';

export const SUPPORTED_AGENTS: AgentName[] = ['roo', 'copilot', 'claude-code'];

function home(): string {
  return process.env.HOME || process.env.USERPROFILE || '~';
}

/**
 * Returns the install directory for a given agent, scope, and skill name.
 *
 * For copilot project scope:
 * - Returns .github/skills/ if that directory already exists (compatibility)
 * - Returns .agents/skills/ otherwise (default)
 */
export function getInstallPath(
  agent: AgentName,
  scope: Scope,
  skillName: string,
): string {
  const root = getInstallRoot(agent, scope);
  return join(root, skillName);
}

export function getInstallRoot(agent: AgentName, scope: Scope): string {
  switch (agent) {
    case 'roo':
      return scope === 'project'
        ? join(process.cwd(), '.roo', 'skills')
        : join(home(), '.roo', 'skills');

    case 'copilot':
      if (scope === 'project') {
        // Compatibility: use .github/skills if it already exists
        const githubPath = join(process.cwd(), '.github', 'skills');
        if (existsSync(githubPath)) {
          return githubPath;
        }
        return join(process.cwd(), '.agents', 'skills');
      }
      return join(home(), '.copilot', 'skills');

    case 'claude-code':
      return scope === 'project'
        ? join(process.cwd(), '.codex', 'skills')
        : join(home(), '.codex', 'skills');
  }
}

/**
 * Returns all scan roots for listing/checking.
 * For copilot project, scans both .agents/skills and .github/skills.
 */
export function getScanRoots(agent: AgentName, scope: Scope): string[] {
  if (agent === 'copilot' && scope === 'project') {
    return [
      join(process.cwd(), '.agents', 'skills'),
      join(process.cwd(), '.github', 'skills'),
    ];
  }
  return [getInstallRoot(agent, scope)];
}

export function parseAgentNames(input: string | undefined): AgentName[] {
  if (!input) return SUPPORTED_AGENTS;
  return input
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a): a is AgentName => SUPPORTED_AGENTS.includes(a as AgentName));
}

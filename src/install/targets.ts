import { join } from 'node:path';
import { agents, detectInstalledAgents as detectInstalledAgentsV2 } from '../agents.ts';
import type { AgentType } from '../types.ts';

export type AgentName = AgentType;
export type Scope = 'project' | 'user';

export const SUPPORTED_AGENTS: AgentName[] = Object.keys(agents) as AgentName[];
const AGENT_ALIASES: Record<string, AgentName> = {
  copilot: 'github-copilot',
};

function normalizeAgentName(agent: string): AgentName | null {
  const lowered = agent.trim().toLowerCase();
  const aliased = AGENT_ALIASES[lowered] ?? lowered;
  return SUPPORTED_AGENTS.includes(aliased as AgentName) ? (aliased as AgentName) : null;
}

export function getInstallPath(agent: AgentName, scope: Scope, skillName: string): string {
  return join(getInstallRoot(agent, scope), skillName);
}

export function getInstallRoot(agent: AgentName, scope: Scope): string {
  const config = agents[agent];
  if (!config) throw new Error(`Unsupported agent: ${agent}`);
  if (scope === 'user') {
    return config.globalSkillsDir ?? join(process.cwd(), config.skillsDir);
  }
  return join(process.cwd(), config.skillsDir);
}

export function getScanRoots(agent: AgentName, scope: Scope): string[] {
  const roots = new Set<string>();
  roots.add(getInstallRoot(agent, scope));
  const canonical = scope === 'user' ? join(process.env.HOME || '', '.agents', 'skills') : join(process.cwd(), '.agents', 'skills');
  roots.add(canonical);
  return [...roots];
}

export interface ParsedAgentSelection {
  agents: AgentName[];
  invalid: string[];
}

export function parseAgentSelection(input: string | string[] | undefined): ParsedAgentSelection {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return { agents: SUPPORTED_AGENTS, invalid: [] };
  }

  const tokens = Array.isArray(input)
    ? input.flatMap((part) => part.split(','))
    : input.split(',');
  const selected = new Set<AgentName>();
  const invalid: string[] = [];

  for (const tokenRaw of tokens) {
    const token = tokenRaw.trim().toLowerCase();
    if (!token) continue;
    if (token === '*') {
      return { agents: SUPPORTED_AGENTS, invalid: [] };
    }
    const normalized = normalizeAgentName(token);
    if (normalized) {
      selected.add(normalized);
    } else {
      invalid.push(tokenRaw.trim());
    }
  }

  return { agents: [...selected], invalid };
}

export function parseAgentNames(input: string | string[] | undefined): AgentName[] {
  return parseAgentSelection(input).agents;
}

export async function detectInstalledAgents(): Promise<AgentName[]> {
  return detectInstalledAgentsV2();
}

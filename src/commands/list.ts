/**
 * `skills list` (alias: `ls`) command.
 *
 * Reads manifest + filesystem state and prints installed skills by scope/agent.
 */

import { existsSync } from 'node:fs';
import { readManifest } from '../state/install-manifest.js';
import {
  parseAgentSelection,
  type AgentName,
} from '../install/targets.js';

interface ListOptions {
  global?: boolean;
  agent?: string;
  json?: boolean;
}

export async function listCommand(options: ListOptions): Promise<number> {
  const scope = options.global ? 'user' : 'project';
  const { agents, invalid } = parseAgentSelection(options.agent);
  if (invalid.length > 0) {
    console.error(`Unknown agents: ${invalid.join(', ')}`);
    return 1;
  }

  const manifest = await readManifest(scope);
  const entries = Object.values(manifest.skills);
  const filtered = entries.filter((entry) => agents.includes(entry.agent as AgentName));

  if (options.json) {
    process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
    return 0;
  }

  if (entries.length === 0) {
    console.log(`No skills installed (${scope} scope).`);
    return 0;
  }

  // Group by agent
  const byAgent = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!agents.includes(entry.agent as AgentName)) continue;
    const list = byAgent.get(entry.agent) || [];
    list.push(entry);
    byAgent.set(entry.agent, list);
  }

  if (byAgent.size === 0) {
    console.log(`No skills found for specified agents (${scope} scope).`);
    return 0;
  }

  console.log(`\nInstalled skills (${scope} scope):\n`);

  for (const [agent, skills] of byAgent) {
    console.log(`  ${agent}:`);
    for (const skill of skills) {
      const exists = existsSync(skill.managed_root);
      const status = exists ? '✓' : '✗ (missing)';
      const commit = skill.resolved_commit.slice(0, 8);
      console.log(`    ${status} ${skill.skill_name}  [${commit}]  ${skill.source_url}`);
    }
    console.log();
  }

  return 0;
}

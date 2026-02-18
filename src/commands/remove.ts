/**
 * `skills remove` (alias: `rm`) command.
 *
 * Removes selected/all skills by scope/agent. Only mutates managed entries.
 */

import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  readManifest,
  removeManyFromManifest,
} from '../state/install-manifest.js';
import {
  getScanRoots,
  parseAgentSelection,
  type AgentName,
} from '../install/targets.js';
import { emitAuditEvent } from '../audit/events.js';

interface RemoveOptions {
  global?: boolean;
  agent?: string;
  yes?: boolean;
  all?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

interface RemovalPlan {
  key: string;
  skill: string;
  agent: string;
  path: string;
}

export async function removeCommand(
  skillNames: string[],
  options: RemoveOptions,
): Promise<number> {
  const scope = options.global ? 'user' : 'project';
  const { agents, invalid } = parseAgentSelection(options.agent);
  if (invalid.length > 0) {
    console.error(`Unknown agents: ${invalid.join(', ')}`);
    return 1;
  }

  const manifest = await readManifest(scope);
  const allEntries = Object.entries(manifest.skills);
  if (allEntries.length === 0) {
    console.log(`No skills installed (${scope} scope).`);
    return 0;
  }

  let toRemove: [string, typeof manifest.skills[string]][] = [];
  if (options.all) {
    toRemove = allEntries.filter(([, entry]) => agents.includes(entry.agent as AgentName));
  } else if (skillNames.length > 0) {
    const names = new Set(skillNames.map((name) => name.toLowerCase()));
    toRemove = allEntries.filter(([, entry]) =>
      names.has(entry.skill_name.toLowerCase()) &&
      agents.includes(entry.agent as AgentName),
    );
  } else {
    console.error('Specify skill names to remove, or use --all.');
    return 1;
  }

  if (toRemove.length === 0) {
    console.log('No matching skills found to remove.');
    return 0;
  }

  const plan: RemovalPlan[] = toRemove.map(([key, entry]) => ({
    key,
    skill: entry.skill_name,
    agent: entry.agent,
    path: entry.managed_root,
  }));

  if (options.dryRun) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ dry_run: true, removals: plan }, null, 2)}\n`);
    } else {
      console.log(`Dry run: ${plan.length} removal(s)\n`);
      for (const step of plan) {
        console.log(`  ${step.skill} (${step.agent})`);
        console.log(`    ${step.path}`);
      }
    }
    return 0;
  }

  const confirmed = await confirmMutation(
    `Remove ${toRemove.length} skill installation(s)?`,
    options.yes === true,
  );
  if (!confirmed.ok) {
    if (confirmed.message) {
      console.error(confirmed.message);
    }
    return 1;
  }

  if (!options.json) {
    console.log(`\nRemoving ${toRemove.length} skill installation(s)...\n`);
  }
  const removedKeys: string[] = [];
  let removed = 0;
  let failed = 0;

  for (const [key, entry] of toRemove) {
    if (!isManagedRootAllowed(entry.managed_root, entry.agent as AgentName, scope)) {
      console.error(`  ✗ Refusing to remove path outside managed roots: ${entry.managed_root}`);
      failed++;
      continue;
    }

    if (entry.managed_root && existsSync(entry.managed_root)) {
      try {
        await rm(entry.managed_root, { recursive: true, force: true });
      } catch (err) {
        console.error(
          `  ✗ Failed to remove ${entry.skill_name} (${entry.agent}): ${err instanceof Error ? err.message : String(err)}`,
        );
        failed++;
        continue;
      }
    }

    removedKeys.push(key);
    if (!options.json) {
      console.log(`  ✓ Removed ${entry.skill_name} from ${entry.agent} (${scope})`);
    }
    removed++;
  }

  await removeManyFromManifest(scope, removedKeys);
  await emitAuditEvent('skill.remove', {
    scope,
    removed,
    failed,
    dry_run: false,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ removed, failed, scope }, null, 2)}\n`);
  } else {
    console.log(`\nDone: ${removed} removed, ${failed} failed.`);
  }

  return failed > 0 ? 1 : 0;
}

function isManagedRootAllowed(
  managedRoot: string,
  agent: AgentName,
  scope: 'project' | 'user',
): boolean {
  const resolvedPath = resolve(managedRoot);
  const allowedRoots = getScanRoots(agent, scope).map((root) => resolve(root));
  return allowedRoots.some((root) => isWithinRoot(resolvedPath, root));
}

function isWithinRoot(path: string, root: string): boolean {
  return path.startsWith(`${root}${sep}`);
}

async function confirmMutation(
  prompt: string,
  yes: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (yes) {
    return { ok: true };
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    return {
      ok: false,
      message: 'Interactive confirmation required. Pass --yes in non-interactive environments.',
    };
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${prompt} [y/N] `)).trim().toLowerCase();
    return { ok: answer === 'y' || answer === 'yes' };
  } finally {
    rl.close();
  }
}

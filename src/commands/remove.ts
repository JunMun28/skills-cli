/**
 * `skills remove` (alias: `rm`) command.
 *
 * Removes selected/all skills by scope/agent. Only mutates managed entries.
 */

import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  readManifest,
  removeFromManifest,
  manifestKey,
} from '../state/install-manifest.js';
import { parseAgentNames, type AgentName } from '../install/targets.js';

interface RemoveOptions {
  global?: boolean;
  agent?: string;
  yes?: boolean;
  all?: boolean;
}

export async function removeCommand(
  skillNames: string[],
  options: RemoveOptions,
): Promise<void> {
  const scope = options.global ? 'user' : 'project';
  const agents = parseAgentNames(options.agent);

  const manifest = await readManifest(scope);
  const allEntries = Object.entries(manifest.skills);

  if (allEntries.length === 0) {
    console.log(`No skills installed (${scope} scope).`);
    return;
  }

  // Filter entries to remove
  let toRemove: [string, typeof manifest.skills[string]][];

  if (options.all) {
    toRemove = allEntries.filter(([, entry]) =>
      agents.includes(entry.agent as AgentName),
    );
  } else if (skillNames.length > 0) {
    const names = new Set(skillNames.map((n) => n.toLowerCase()));
    toRemove = allEntries.filter(
      ([, entry]) =>
        names.has(entry.skill_name.toLowerCase()) &&
        agents.includes(entry.agent as AgentName),
    );
  } else {
    console.error('Specify skill names to remove, or use --all.');
    process.exit(1);
  }

  if (toRemove.length === 0) {
    console.log('No matching skills found to remove.');
    return;
  }

  console.log(`\nRemoving ${toRemove.length} skill installation(s)...\n`);

  let removed = 0;

  for (const [key, entry] of toRemove) {
    // Only delete managed directories
    if (entry.managed_root && existsSync(entry.managed_root)) {
      try {
        await rm(entry.managed_root, { recursive: true, force: true });
      } catch (err) {
        console.error(
          `  ✗ Failed to remove ${entry.skill_name} (${entry.agent}): ${err instanceof Error ? err.message : err}`,
        );
        continue;
      }
    }

    await removeFromManifest(scope, key);
    console.log(`  ✓ Removed ${entry.skill_name} from ${entry.agent} (${scope})`);
    removed++;
  }

  console.log(`\nDone: ${removed} removed.`);
}

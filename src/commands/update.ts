/**
 * `skills update` (alias: `upgrade`) command.
 *
 * Detects newer commits for tracked refs, reinstalls safely, updates manifest.
 * Leaves current install intact on fetch/install failure.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  readManifest,
  addManyToManifest,
} from '../state/install-manifest.js';
import {
  parseAgentSelection,
  type AgentName,
  getInstallPath,
} from '../install/targets.js';
import { cloneToCache, resolveCommit, lsRemote } from '../git/cache.js';
import { discoverSkills } from '../skills/discovery.js';
import { copySkill } from '../install/copier.js';
import { isDomainAllowed } from '../policy/domain-allowlist.js';
import { emitAuditEvent } from '../audit/events.js';
import type { ManifestEntry } from '../state/manifest-schema.js';

interface UpdateOptions {
  global?: boolean;
  agent?: string;
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

interface PendingUpdate {
  key: string;
  entry: ManifestEntry;
  remoteCommit: string;
}

export async function updateCommand(options: UpdateOptions): Promise<number> {
  const scope = options.global ? 'user' : 'project';
  const log = (message: string): void => {
    if (options.json) {
      console.error(message);
    } else {
      console.log(message);
    }
  };
  const { agents, invalid } = parseAgentSelection(options.agent);
  if (invalid.length > 0) {
    console.error(`Unknown agents: ${invalid.join(', ')}`);
    return 1;
  }

  const manifest = await readManifest(scope);
  const entries = Object.entries(manifest.skills);
  if (entries.length === 0) {
    log(`No skills installed (${scope} scope).`);
    return 0;
  }

  const remoteCache = new Map<string, Promise<string | null>>();
  const getRemoteCommit = (url: string, ref: string): Promise<string | null> => {
    const key = `${url}::${ref}`;
    if (!remoteCache.has(key)) {
      remoteCache.set(key, lsRemote(url, ref));
    }
    return remoteCache.get(key)!;
  };

  let skipped = 0;
  const pending: PendingUpdate[] = [];

  for (const [key, entry] of entries) {
    if (!agents.includes(entry.agent as AgentName)) {
      continue;
    }

    if (!isDomainAllowed(entry.source_url)) {
      log(`  ⚠ ${entry.skill_name} (${entry.agent}): domain not in allowlist, skipped`);
      skipped++;
      continue;
    }

    const ref = entry.ref || 'HEAD';
    const remoteCommit = await getRemoteCommit(entry.source_url, ref);
    if (!remoteCommit) {
      log(`  ? ${entry.skill_name} (${entry.agent}): remote unreachable, skipped`);
      skipped++;
      continue;
    }

    if (remoteCommit === entry.resolved_commit) {
      skipped++;
      continue;
    }

    pending.push({ key, entry, remoteCommit });
  }

  if (options.dryRun) {
    const payload = pending.map((update) => ({
      key: update.key,
      skill: update.entry.skill_name,
      agent: update.entry.agent,
      from: update.entry.resolved_commit,
      to: update.remoteCommit,
    }));
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ dry_run: true, updates: payload }, null, 2)}\n`);
    } else {
      log(`Dry run: ${payload.length} update(s)\n`);
      for (const update of payload) {
        log(`  ${update.skill} (${update.agent}): ${update.from.slice(0, 8)} -> ${update.to.slice(0, 8)}`);
      }
    }
    return 0;
  }

  if (pending.length === 0) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ updated: 0, skipped, failed: 0, scope }, null, 2)}\n`);
    } else {
      log(`\nDone: 0 updated, ${skipped} up-to-date, 0 failed.`);
    }
    return 0;
  }

  const confirmed = await confirmMutation(
    `Update ${pending.length} skill installation(s)?`,
    options.yes === true,
  );
  if (!confirmed.ok) {
    if (confirmed.message) {
      console.error(confirmed.message);
    }
    return 1;
  }

  let updated = 0;
  let failed = 0;
  const updatedEntries: ManifestEntry[] = [];

  for (const candidate of pending) {
    const { entry, remoteCommit } = candidate;
    log(`  ↑ ${entry.skill_name} (${entry.agent}): ${entry.resolved_commit.slice(0, 8)} → ${remoteCommit.slice(0, 8)}`);

    try {
      const repoDir = await cloneToCache(entry.source_url, entry.ref, remoteCommit);
      const commit = await resolveCommit(repoDir);

      const skills = await discoverSkills(repoDir, entry.subpath);
      const skill = skills.find((current) => current.name === entry.skill_name);
      if (!skill) {
        console.error(`    ✗ Skill "${entry.skill_name}" no longer found in source`);
        failed++;
        continue;
      }

      const targetPath = getInstallPath(
        entry.agent as AgentName,
        entry.scope,
        entry.skill_name,
      );
      const result = await copySkill(skill.path, targetPath);
      if (!result.success) {
        console.error(`    ✗ Install failed: ${result.error}`);
        failed++;
        continue;
      }

      updatedEntries.push({
        ...entry,
        resolved_commit: commit,
        managed_root: targetPath,
        updated_at: new Date().toISOString(),
      });
      updated++;
      log('    ✓ Updated successfully');
    } catch (err) {
      console.error(`    ✗ ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  await addManyToManifest(scope, updatedEntries);
  await emitAuditEvent('skill.update', {
    scope,
    updated,
    skipped,
    failed,
    dry_run: false,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ updated, skipped, failed, scope }, null, 2)}\n`);
  } else {
    log(`\nDone: ${updated} updated, ${skipped} up-to-date, ${failed} failed.`);
  }

  return failed > 0 ? 1 : 0;
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

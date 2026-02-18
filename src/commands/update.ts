/**
 * `skills update` (alias: `upgrade`) command.
 *
 * Detects newer commits for tracked refs, reinstalls safely, updates manifest.
 * Leaves current install intact on fetch/install failure.
 */

import { readManifest, addToManifest } from '../state/install-manifest.js';
import { parseAgentNames, type AgentName, getInstallPath } from '../install/targets.js';
import { cloneToCache, resolveCommit, lsRemote } from '../git/cache.js';
import { discoverSkills } from '../skills/discovery.js';
import { copySkill } from '../install/copier.js';
import { isDomainAllowed } from '../policy/domain-allowlist.js';

interface UpdateOptions {
  global?: boolean;
  agent?: string;
  yes?: boolean;
}

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const scope = options.global ? 'user' : 'project';
  const agents = parseAgentNames(options.agent);

  const manifest = await readManifest(scope);
  const entries = Object.entries(manifest.skills);

  if (entries.length === 0) {
    console.log(`No skills installed (${scope} scope).`);
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [key, entry] of entries) {
    if (!agents.includes(entry.agent as AgentName)) continue;

    // Skip entries with policy violations
    if (!isDomainAllowed(entry.source_url)) {
      console.log(`  ⚠ ${entry.skill_name} (${entry.agent}): domain not in allowlist, skipped`);
      skipped++;
      continue;
    }

    // Check if update available
    const ref = entry.ref || 'HEAD';
    const remoteCommit = await lsRemote(entry.source_url, ref);

    if (!remoteCommit) {
      console.log(`  ? ${entry.skill_name} (${entry.agent}): remote unreachable, skipped`);
      skipped++;
      continue;
    }

    if (remoteCommit === entry.resolved_commit) {
      skipped++;
      continue;
    }

    // Update available - clone fresh and reinstall
    console.log(`  ↑ ${entry.skill_name} (${entry.agent}): ${entry.resolved_commit.slice(0, 8)} → ${remoteCommit.slice(0, 8)}`);

    try {
      const repoDir = await cloneToCache(entry.source_url, entry.ref);
      const commit = await resolveCommit(repoDir);

      const skills = await discoverSkills(repoDir, entry.subpath);
      const skill = skills.find((s) => s.name === entry.skill_name);

      if (!skill) {
        console.error(`    ✗ Skill "${entry.skill_name}" no longer found in source`);
        failed++;
        continue;
      }

      const targetPath = getInstallPath(entry.agent as AgentName, entry.scope, entry.skill_name);
      const result = await copySkill(skill.path, targetPath);

      if (!result.success) {
        console.error(`    ✗ Install failed: ${result.error}`);
        failed++;
        continue;
      }

      // Update manifest
      await addToManifest(scope, {
        ...entry,
        resolved_commit: commit,
        updated_at: new Date().toISOString(),
      });

      console.log(`    ✓ Updated successfully`);
      updated++;
    } catch (err) {
      console.error(`    ✗ ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} up-to-date, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

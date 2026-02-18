/**
 * `skills add <source>` command.
 *
 * Flow: parse source -> enforce domain allowlist -> resolve/pin commit
 * -> discover skills -> validate -> copy install -> record manifest.
 */

import { parseSource } from '../source/parse-source.js';
import { assertDomainAllowed } from '../policy/domain-allowlist.js';
import { cloneToCache, resolveCommit } from '../git/cache.js';
import { discoverSkills, type SkillInfo } from '../skills/discovery.js';
import { validateSkillName, validatePath } from '../skills/validate.js';
import { copySkill } from '../install/copier.js';
import {
  getInstallPath,
  parseAgentNames,
  type AgentName,
  SUPPORTED_AGENTS,
} from '../install/targets.js';
import {
  addToManifest,
  generateInstallId,
  readManifest,
  manifestKey,
} from '../state/install-manifest.js';
import type { ManifestEntry } from '../state/manifest-schema.js';

interface AddOptions {
  global?: boolean;
  agent?: string;
  skill?: string;
  yes?: boolean;
  all?: boolean;
}

export async function addCommand(source: string, options: AddOptions): Promise<void> {
  const scope = options.global ? 'user' : 'project';

  // 1. Parse source
  const parsed = parseSource(source);
  console.log(`Resolving source: ${parsed.url}${parsed.ref ? `@${parsed.ref}` : ''}${parsed.subpath ? `/${parsed.subpath}` : ''}`);

  // 2. Enforce domain allowlist
  assertDomainAllowed(parsed.url);

  // 3. Clone/fetch and pin commit
  console.log('Cloning repository...');
  const repoDir = await cloneToCache(parsed.url, parsed.ref);
  const commit = await resolveCommit(repoDir);
  console.log(`Pinned to commit: ${commit.slice(0, 8)}`);

  // 4. Discover skills
  const allSkills = await discoverSkills(repoDir, parsed.subpath);
  if (allSkills.length === 0) {
    console.error('No skills found in the source.');
    process.exit(1);
  }

  // 5. Filter skills if --skill flag provided
  let skills = allSkills;
  if (options.skill && options.skill !== '*') {
    const names = options.skill.split(',').map((s) => s.trim().toLowerCase());
    skills = allSkills.filter((s) => names.includes(s.name.toLowerCase()));
    if (skills.length === 0) {
      console.error(`No skills matching: ${options.skill}`);
      console.log(`Available skills: ${allSkills.map((s) => s.name).join(', ')}`);
      process.exit(1);
    }
  }

  // 6. Determine target agents
  const agents = options.all
    ? SUPPORTED_AGENTS
    : parseAgentNames(options.agent);

  if (agents.length === 0) {
    console.error('No valid agents specified.');
    process.exit(1);
  }

  // 7. Validate and install each skill to each agent
  console.log(`\nInstalling ${skills.length} skill(s) to ${agents.length} agent(s)...`);

  let installed = 0;
  let failed = 0;

  for (const skill of skills) {
    const nameValidation = validateSkillName(skill.name);
    if (!nameValidation.valid) {
      console.error(`Invalid skill name "${skill.name}": ${nameValidation.errors.join(', ')}`);
      failed++;
      continue;
    }

    if (parsed.subpath) {
      const pathValidation = validatePath(parsed.subpath);
      if (!pathValidation.valid) {
        console.error(`Invalid path: ${pathValidation.errors.join(', ')}`);
        failed++;
        continue;
      }
    }

    for (const agent of agents) {
      const targetPath = getInstallPath(agent, scope, skill.name);
      const result = await copySkill(skill.path, targetPath);

      if (result.success) {
        const entry: ManifestEntry = {
          install_id: generateInstallId(),
          source_url: parsed.url,
          source_type: 'git',
          resolved_commit: commit,
          ref: parsed.ref,
          subpath: parsed.subpath,
          skill_name: skill.name,
          skill_path: skill.relativePath,
          agent,
          scope,
          managed_root: targetPath,
          installed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await addToManifest(scope, entry);
        console.log(`  ✓ ${skill.name} → ${agent} (${scope})`);
        installed++;
      } else {
        console.error(`  ✗ ${skill.name} → ${agent}: ${result.error}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${installed} installed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * `skills add <source>` command.
 *
 * Flow: parse source -> enforce domain allowlist -> resolve/pin commit
 * -> discover skills -> validate -> transactional install -> record manifest.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { rm } from 'node:fs/promises';
import { parseSource } from '../source/parse-source.js';
import { assertDomainAllowed } from '../policy/domain-allowlist.js';
import { cloneToCache, resolveCommit } from '../git/cache.js';
import { discoverSkills } from '../skills/discovery.js';
import { validateSkillName, validatePath } from '../skills/validate.js';
import {
  getInstallPath,
  parseAgentSelection,
  type AgentName,
  SUPPORTED_AGENTS,
} from '../install/targets.js';
import {
  addManyToManifest,
  generateInstallId,
} from '../state/install-manifest.js';
import type { ManifestEntry } from '../state/manifest-schema.js';
import {
  executeInstallTransaction,
  type InstallStep,
} from '../install/transaction.js';
import { emitAuditEvent } from '../audit/events.js';

interface AddOptions {
  global?: boolean;
  agent?: string;
  skill?: string;
  yes?: boolean;
  all?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

interface InstallOperation {
  step: InstallStep;
  entry: ManifestEntry;
}

interface DryRunResult {
  scope: 'project' | 'user';
  source: string;
  commit: string;
  operations: Array<{ skill: string; agent: AgentName; target: string }>;
}

export async function addCommand(source: string, options: AddOptions): Promise<number> {
  const scope = options.global ? 'user' : 'project';
  const log = (message: string): void => {
    if (options.json) {
      console.error(message);
    } else {
      console.log(message);
    }
  };

  try {
    const parsed = parseSource(source);
    if (parsed.subpath) {
      const pathValidation = validatePath(parsed.subpath);
      if (!pathValidation.valid) {
        console.error(`Invalid path: ${pathValidation.errors.join(', ')}`);
        await emitAuditEvent('error', {
          command: 'add',
          source,
          reason: 'invalid_subpath',
        });
        return 1;
      }
    }

    assertDomainAllowed(parsed.url);
    log(`Resolving source: ${parsed.url}${parsed.ref ? `@${parsed.ref}` : ''}${parsed.subpath ? `/${parsed.subpath}` : ''}`);

    log('Cloning repository...');
    const repoDir = await cloneToCache(parsed.url, parsed.ref);
    const commit = await resolveCommit(repoDir);
    log(`Pinned to commit: ${commit.slice(0, 8)}`);

    const allSkills = await discoverSkills(repoDir, parsed.subpath);
    if (allSkills.length === 0) {
      console.error('No skills found in the source.');
      await emitAuditEvent('error', {
        command: 'add',
        source: parsed.url,
        reason: 'no_skills_found',
      });
      return 1;
    }

    let skills = allSkills;
    if (options.skill && options.skill !== '*') {
      const names = options.skill.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      skills = allSkills.filter((s) => names.includes(s.name.toLowerCase()));
      if (skills.length === 0) {
        console.error(`No skills matching: ${options.skill}`);
        console.error(`Available skills: ${allSkills.map((s) => s.name).join(', ')}`);
        return 1;
      }
    }

    const agentSelection = await resolveAddAgents(options);
    if (!agentSelection.ok) {
      console.error(agentSelection.error);
      return 1;
    }
    const agents = agentSelection.agents;

    const operations: InstallOperation[] = [];
    for (const skill of skills) {
      const nameValidation = validateSkillName(skill.name);
      if (!nameValidation.valid) {
        console.error(`Invalid skill name "${skill.name}": ${nameValidation.errors.join(', ')}`);
        return 1;
      }

      for (const agent of agents) {
        const targetPath = getInstallPath(agent, scope, skill.name);
        const timestamp = new Date().toISOString();
        operations.push({
          step: {
            sourcePath: skill.path,
            targetPath,
          },
          entry: {
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
            installed_at: timestamp,
            updated_at: timestamp,
          },
        });
      }
    }

    if (options.dryRun) {
      return printDryRun(
        {
          scope,
          source: parsed.url,
          commit,
          operations: operations.map((operation) => ({
            skill: operation.entry.skill_name,
            agent: operation.entry.agent as AgentName,
            target: operation.step.targetPath,
          })),
        },
        options.json === true,
      );
    }

    const confirmed = await confirmMutation(
      `Install ${operations.length} skill target(s)?`,
      options.yes === true,
    );
    if (!confirmed.ok) {
      if (confirmed.message) {
        console.error(confirmed.message);
      }
      return 1;
    }

    log(`\nInstalling ${skills.length} skill(s) to ${agents.length} agent(s)...`);
    const txnResult = await executeInstallTransaction(
      operations.map((operation) => operation.step),
    );

    if (!txnResult.success) {
      for (const error of txnResult.errors) {
        console.error(`  ✗ ${error}`);
      }
      await emitAuditEvent('error', {
        command: 'add',
        source: parsed.url,
        reason: 'transaction_failed',
        errors: txnResult.errors,
      });
      return 1;
    }

    try {
      await addManyToManifest(
        scope,
        operations.map((operation) => operation.entry),
      );
    } catch (err) {
      await rollbackInstalledPaths(
        operations.map((operation) => operation.step.targetPath),
      );
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to write manifest. Rolled back installed files. ${message}`);
      await emitAuditEvent('error', {
        command: 'add',
        source: parsed.url,
        reason: 'manifest_write_failed',
        error: message,
      });
      return 1;
    }

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ installed: operations.length, failed: 0, scope }, null, 2)}\n`,
      );
    } else {
      for (const operation of operations) {
        console.log(`  ✓ ${operation.entry.skill_name} → ${operation.entry.agent} (${scope})`);
      }
      console.log(`\nDone: ${operations.length} installed, 0 failed.`);
    }

    await emitAuditEvent('skill.add', {
      scope,
      installed: operations.length,
      source: parsed.url,
      commit,
      dry_run: false,
    });
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    await emitAuditEvent('error', {
      command: 'add',
      source,
      reason: 'unexpected_error',
      error: message,
    });
    return 1;
  }
}

function printDryRun(result: DryRunResult, json: boolean): number {
  if (json) {
    process.stdout.write(`${JSON.stringify({ dry_run: true, ...result }, null, 2)}\n`);
    return 0;
  }

  console.log(`Dry run: ${result.operations.length} install target(s)\n`);
  for (const operation of result.operations) {
    console.log(`  ${operation.skill} -> ${operation.agent}`);
    console.log(`    ${operation.target}`);
  }
  return 0;
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

type AgentSelectionResult =
  | { ok: true; agents: AgentName[] }
  | { ok: false; error: string };

async function resolveAddAgents(options: AddOptions): Promise<AgentSelectionResult> {
  if (options.all) {
    return { ok: true, agents: SUPPORTED_AGENTS };
  }

  if (options.agent) {
    const { agents, invalid } = parseAgentSelection(options.agent);
    if (invalid.length > 0) {
      return { ok: false, error: `Unknown agents: ${invalid.join(', ')}` };
    }
    if (agents.length === 0) {
      return { ok: false, error: 'No valid agents specified.' };
    }
    return { ok: true, agents };
  }

  if (options.yes) {
    return { ok: true, agents: SUPPORTED_AGENTS };
  }

  if (options.json) {
    return { ok: false, error: 'In --json mode, specify --agent (or --all/--yes).' };
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    return {
      ok: false,
      error: 'No agent specified. Pass --agent, --all, or --yes in non-interactive environments.',
    };
  }

  const agents = await promptAgentSelection();
  if (agents.length === 0) {
    return { ok: false, error: 'No valid agents selected.' };
  }
  return { ok: true, agents };
}

async function promptAgentSelection(): Promise<AgentName[]> {
  console.log('\nWhich agents do you want to install to?');
  console.log('  1) roo');
  console.log('  2) copilot');
  console.log('  3) claude-code');
  console.log('  Enter names or numbers (comma-separated), or "*" for all.');

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question('Agents: ')).trim().toLowerCase();
    if (!answer || answer === '*' || answer === 'all') {
      return SUPPORTED_AGENTS;
    }

    const byIndex: Record<string, AgentName> = {
      '1': 'roo',
      '2': 'copilot',
      '3': 'claude-code',
    };
    const selected = new Set<AgentName>();

    for (const rawToken of answer.split(',').map((token) => token.trim()).filter(Boolean)) {
      const token = byIndex[rawToken] || rawToken;
      if (SUPPORTED_AGENTS.includes(token as AgentName)) {
        selected.add(token as AgentName);
      }
    }

    return [...selected];
  } finally {
    rl.close();
  }
}

async function rollbackInstalledPaths(paths: string[]): Promise<void> {
  const uniquePaths = [...new Set(paths)];
  await Promise.all(
    uniquePaths.map(async (path) => {
      try {
        await rm(path, { recursive: true, force: true });
      } catch {
        // Best-effort rollback.
      }
    }),
  );
}

/**
 * `skills check` command.
 *
 * Validates install structure, policy, and source reachability.
 *
 * Status codes:
 * - valid: installed, matches manifest, source reachable
 * - outdated: remote ref has newer commit than installed
 * - policy_violation: domain no longer in allowlist or path issues
 * - unreachable: cannot contact remote
 * - orphaned_ref: tracked ref no longer exists
 * - missing: files not on disk
 */

import { existsSync } from 'node:fs';
import { readManifest } from '../state/install-manifest.js';
import { isDomainAllowed } from '../policy/domain-allowlist.js';
import { lsRemote } from '../git/cache.js';
import { parseAgentSelection, type AgentName } from '../install/targets.js';
import { emitAuditEvent } from '../audit/events.js';

export type CheckStatus =
  | 'valid'
  | 'outdated'
  | 'policy_violation'
  | 'unreachable'
  | 'orphaned_ref'
  | 'missing';

export interface CheckResult {
  key: string;
  skillName: string;
  agent: string;
  status: CheckStatus;
  detail: string;
  currentCommit: string;
  remoteCommit?: string;
}

interface CheckOptions {
  global?: boolean;
  agent?: string;
  json?: boolean;
}

export async function checkCommand(options: CheckOptions): Promise<number> {
  const scope = options.global ? 'user' : 'project';
  const { agents, invalid } = parseAgentSelection(options.agent);
  if (invalid.length > 0) {
    console.error(`Unknown agents: ${invalid.join(', ')}`);
    return 1;
  }

  const manifest = await readManifest(scope);
  const entries = Object.entries(manifest.skills);

  if (entries.length === 0) {
    if (options.json) {
      process.stdout.write('[]\n');
    } else {
      console.log(`No skills installed (${scope} scope).`);
    }
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

  const results: CheckResult[] = [];
  const checks: Promise<CheckResult>[] = [];
  for (const [key, entry] of entries) {
    if (agents.includes(entry.agent as AgentName)) {
      checks.push(checkEntry(key, entry, getRemoteCommit));
    }
  }
  results.push(...await Promise.all(checks));

  if (results.length === 0) {
    if (options.json) {
      process.stdout.write('[]\n');
    } else {
      console.log('No matching entries to check.');
    }
    return 0;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    // Print results
    const statusIcon: Record<CheckStatus, string> = {
      valid: '✓',
      outdated: '↑',
      policy_violation: '⚠',
      unreachable: '?',
      orphaned_ref: '⚠',
      missing: '✗',
    };

    console.log(`\nCheck results (${scope} scope):\n`);

    for (const r of results) {
      console.log(`  ${statusIcon[r.status]} ${r.skillName} (${r.agent}): ${r.status}`);
      if (r.detail) {
        console.log(`    ${r.detail}`);
      }
    }

    const valid = results.filter((r) => r.status === 'valid').length;
    const issues = results.length - valid;
    console.log(`\n${valid} valid, ${issues} issue(s) found.`);
  }
  await emitAuditEvent('skill.check', {
    scope,
    checked: results.length,
  });

  const valid = results.filter((r) => r.status === 'valid').length;
  const issues = results.length - valid;
  if (issues > 0) {
    return 1;
  }
  return 0;
}

async function checkEntry(
  key: string,
  entry: {
    skill_name: string;
    agent: string;
    source_url: string;
    resolved_commit: string;
    ref: string | undefined;
    managed_root: string;
  },
  getRemoteCommit: (url: string, ref: string) => Promise<string | null> = lsRemote,
): Promise<CheckResult> {
  const base = {
    key,
    skillName: entry.skill_name,
    agent: entry.agent,
    currentCommit: entry.resolved_commit,
  };

  // 1. Check files exist on disk
  if (!existsSync(entry.managed_root)) {
    return { ...base, status: 'missing', detail: `Path not found: ${entry.managed_root}` };
  }

  // 2. Check domain policy
  if (!isDomainAllowed(entry.source_url)) {
    return {
      ...base,
      status: 'policy_violation',
      detail: `Domain no longer in allowlist: ${entry.source_url}`,
    };
  }

  // 3. Check remote reachability and ref status
  const ref = entry.ref || 'HEAD';
  const remoteCommit = await getRemoteCommit(entry.source_url, ref);

  if (remoteCommit === null) {
    // Try HEAD as fallback if specific ref failed
    if (ref !== 'HEAD') {
      const headCommit = await getRemoteCommit(entry.source_url, 'HEAD');
      if (headCommit === null) {
        return { ...base, status: 'unreachable', detail: 'Cannot reach remote repository' };
      }
      return { ...base, status: 'orphaned_ref', detail: `Ref "${ref}" no longer exists on remote` };
    }
    return { ...base, status: 'unreachable', detail: 'Cannot reach remote repository' };
  }

  // 4. Compare commits
  if (remoteCommit !== entry.resolved_commit) {
    return {
      ...base,
      status: 'outdated',
      detail: `Installed: ${entry.resolved_commit.slice(0, 8)}, Remote: ${remoteCommit.slice(0, 8)}`,
      remoteCommit,
    };
  }

  return { ...base, status: 'valid', detail: '' };
}

export { checkEntry };

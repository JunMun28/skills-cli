/**
 * Git clone cache.
 *
 * Caches cloned repositories to avoid redundant fetches.
 * Cache key: url + ref + subpath
 */

import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { runGit } from './run-git.js';

function cacheDir(): string {
  return (
    process.env.SKILLS_CACHE_DIR ||
    join(process.env.HOME || tmpdir(), '.cache', 'skills', 'git')
  );
}

function cacheKey(url: string, ref?: string): string {
  const hash = createHash('sha256')
    .update(`${url}:${ref || 'HEAD'}`)
    .digest('hex')
    .slice(0, 16);
  return hash;
}

/**
 * Clone a repo with shallow depth. Returns the local cache path.
 * If cached and valid, reuses existing clone.
 */
export async function cloneToCache(
  url: string,
  ref?: string,
  expectedCommit?: string,
): Promise<string> {
  const dir = cacheDir();
  const key = cacheKey(url, ref);
  const repoDir = join(dir, key);

  if (existsSync(join(repoDir, '.git'))) {
    if (expectedCommit) {
      try {
        const localHead = await resolveCommit(repoDir);
        if (localHead === expectedCommit) {
          return repoDir;
        }
      } catch {
        // Fallback to fetch/reclone path below.
      }
    }

    // Existing cache: fetch latest
    try {
      await runGit(['fetch', '--depth', '1', 'origin', ref || 'HEAD'], { cwd: repoDir });
      return repoDir;
    } catch {
      // Cache invalid; re-clone
      await rm(repoDir, { recursive: true, force: true });
    }
  }

  await mkdir(dir, { recursive: true });

  const args = ['clone', '--depth', '1', '--single-branch'];
  if (ref) {
    args.push('--branch', ref);
  }
  args.push(url, repoDir);

  await runGit(args);
  return repoDir;
}

/** Resolve the current HEAD commit SHA of a cached repo. */
export async function resolveCommit(repoDir: string): Promise<string> {
  const sha = await runGit(['rev-parse', '--verify', 'HEAD'], { cwd: repoDir });
  return sha;
}

/** Check if a remote ref exists and get its commit SHA. */
export async function lsRemote(
  url: string,
  ref?: string,
): Promise<string | null> {
  try {
    const args = ['ls-remote', '--refs', '--exit-code', url];
    if (ref) {
      args.push(ref);
    }
    const output = await runGit(args);
    // Output format: <sha>\t<ref>
    const line = output.split('\n')[0];
    if (line) {
      const sha = line.split('\t')[0]?.trim();
      return sha || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Install manifest persistence.
 *
 * Atomic writes via temp file + rename to prevent corruption.
 * Supports both project-scope and user-scope manifests.
 */

import {
  readFile,
  writeFile,
  rename,
  mkdir,
  open,
  stat,
  unlink,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type Manifest,
  type ManifestEntry,
  createEmptyManifest,
  migrateManifest,
  validateManifest,
  ManifestSchemaVersionError,
  MANIFEST_SCHEMA_VERSION,
} from './manifest-schema.js';

const MANIFEST_FILENAME = '.skills-manifest.json';
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;
const LOCK_INITIAL_DELAY_MS = 25;

export function getProjectManifestPath(): string {
  return join(process.cwd(), MANIFEST_FILENAME);
}

export function getUserManifestPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return join(home, '.config', 'skills', MANIFEST_FILENAME);
}

export function getManifestPath(scope: 'project' | 'user'): string {
  return scope === 'project' ? getProjectManifestPath() : getUserManifestPath();
}

export async function readManifest(scope: 'project' | 'user'): Promise<Manifest> {
  const path = getManifestPath(scope);

  if (!existsSync(path)) {
    return createEmptyManifest();
  }

  try {
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw);
    const migrated = migrateManifest(data);
    const errors = validateManifest(migrated);
    if (errors.length > 0) {
      console.error(
        `Warning: ignoring invalid manifest at ${path}: ${errors.join('; ')}`,
      );
      return createEmptyManifest();
    }
    return migrated;
  } catch (err) {
    if (err instanceof ManifestSchemaVersionError) {
      throw err;
    }
    console.error(`Warning: failed to read manifest at ${path}, using empty manifest.`);
    return createEmptyManifest();
  }
}

/** Atomic write: write to temp then rename */
export async function writeManifest(
  scope: 'project' | 'user',
  manifest: Manifest,
): Promise<void> {
  const path = getManifestPath(scope);
  const dir = dirname(path);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const tmpPath = `${path}.${randomUUID()}.tmp`;
  const content = JSON.stringify(manifest, null, 2) + '\n';

  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, path);
}

export function generateInstallId(): string {
  return randomUUID();
}

/** Build a manifest entry key: agent:scope:skill_name */
export function manifestKey(agent: string, scope: 'project' | 'user', skillName: string): string {
  return `${agent}:${scope}:${skillName}`;
}

export async function addToManifest(
  scope: 'project' | 'user',
  entry: ManifestEntry,
): Promise<void> {
  await addManyToManifest(scope, [entry]);
}

export async function removeFromManifest(
  scope: 'project' | 'user',
  key: string,
): Promise<ManifestEntry | undefined> {
  const removed = await removeManyFromManifest(scope, [key]);
  return removed[0];
}

export async function addManyToManifest(
  scope: 'project' | 'user',
  entries: ManifestEntry[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await withManifestLock(scope, async () => {
    const manifest = await readManifest(scope);
    for (const entry of entries) {
      const key = manifestKey(entry.agent, entry.scope, entry.skill_name);
      manifest.skills[key] = entry;
    }
    manifest.schema_version = MANIFEST_SCHEMA_VERSION;
    await writeManifest(scope, manifest);
  });
}

export async function removeManyFromManifest(
  scope: 'project' | 'user',
  keys: string[],
): Promise<(ManifestEntry | undefined)[]> {
  if (keys.length === 0) {
    return [];
  }

  return withManifestLock(scope, async () => {
    const manifest = await readManifest(scope);
    const removed: (ManifestEntry | undefined)[] = [];
    for (const key of keys) {
      const entry = manifest.skills[key];
      if (entry) {
        delete manifest.skills[key];
      }
      removed.push(entry);
    }
    await writeManifest(scope, manifest);
    return removed;
  });
}

async function withManifestLock<T>(
  scope: 'project' | 'user',
  fn: () => Promise<T>,
): Promise<T> {
  const lockPath = `${getManifestPath(scope)}.lock`;
  await acquireManifestLock(lockPath);
  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => {
      // Ignore unlock failures.
    });
  }
}

async function acquireManifestLock(lockPath: string): Promise<void> {
  const start = Date.now();
  let delayMs = LOCK_INITIAL_DELAY_MS;

  while (Date.now() - start < LOCK_TIMEOUT_MS) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.close();
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw err;
      }
    }

    await cleanupStaleLock(lockPath);
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 250);
  }

  throw new Error(`Timed out waiting for manifest lock: ${lockPath}`);
}

async function cleanupStaleLock(lockPath: string): Promise<void> {
  try {
    const lockStat = await stat(lockPath);
    if (Date.now() - lockStat.mtimeMs > LOCK_STALE_MS) {
      await unlink(lockPath).catch(() => {
        // Another process may have removed it.
      });
    }
  } catch {
    // Lock may disappear between checks.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

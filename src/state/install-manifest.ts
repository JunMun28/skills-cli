/**
 * Install manifest persistence.
 *
 * Atomic writes via temp file + rename to prevent corruption.
 * Supports both project-scope and user-scope manifests.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type Manifest,
  type ManifestEntry,
  createEmptyManifest,
  migrateManifest,
  MANIFEST_SCHEMA_VERSION,
} from './manifest-schema.js';

const MANIFEST_FILENAME = '.skills-manifest.json';

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
    return migrateManifest(data);
  } catch {
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
  const manifest = await readManifest(scope);
  const key = manifestKey(entry.agent, entry.scope, entry.skill_name);
  manifest.skills[key] = entry;
  manifest.schema_version = MANIFEST_SCHEMA_VERSION;
  await writeManifest(scope, manifest);
}

export async function removeFromManifest(
  scope: 'project' | 'user',
  key: string,
): Promise<ManifestEntry | undefined> {
  const manifest = await readManifest(scope);
  const entry = manifest.skills[key];
  if (entry) {
    delete manifest.skills[key];
    await writeManifest(scope, manifest);
  }
  return entry;
}

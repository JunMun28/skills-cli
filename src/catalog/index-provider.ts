/**
 * Internal catalog index provider.
 *
 * Reads and caches the internal Git-hosted index.json catalog.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogEntry } from '../commands/find.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return join(home, '.cache', 'skills', 'catalog');
}

function getCachePath(): string {
  return join(getCacheDir(), 'index.json');
}

export async function isCacheStale(): Promise<boolean> {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) return true;

  try {
    const s = await stat(cachePath);
    return Date.now() - s.mtimeMs > CACHE_TTL_MS;
  } catch {
    return true;
  }
}

export async function writeCatalogCache(entries: CatalogEntry[]): Promise<void> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
  await writeFile(getCachePath(), JSON.stringify(entries, null, 2), 'utf-8');
}

export async function readCatalogCache(): Promise<CatalogEntry[] | null> {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) return null;

  try {
    const raw = await readFile(cachePath, 'utf-8');
    return JSON.parse(raw) as CatalogEntry[];
  } catch {
    return null;
  }
}

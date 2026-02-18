/**
 * Internal catalog index provider.
 *
 * Reads and caches the internal Git-hosted index.json catalog.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseCatalogJson, type CatalogEntry } from './types.js';

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return join(home, '.cache', 'skills', 'catalog');
}

function getCacheKey(catalogUrl: string): string {
  return createHash('sha256').update(catalogUrl).digest('hex').slice(0, 16);
}

export function getCachePath(catalogUrl: string): string {
  return join(getCacheDir(), `${getCacheKey(catalogUrl)}.json`);
}

export async function isCacheStale(catalogUrl: string): Promise<boolean> {
  const cachePath = getCachePath(catalogUrl);
  if (!existsSync(cachePath)) return true;

  try {
    const s = await stat(cachePath);
    return Date.now() - s.mtimeMs > CACHE_TTL_MS;
  } catch {
    return true;
  }
}

export async function writeCatalogCache(
  catalogUrl: string,
  entries: CatalogEntry[],
): Promise<void> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
  await writeFile(getCachePath(catalogUrl), JSON.stringify(entries, null, 2), 'utf-8');
}

export async function readCatalogCache(catalogUrl: string): Promise<CatalogEntry[] | null> {
  const cachePath = getCachePath(catalogUrl);
  if (!existsSync(cachePath)) return null;

  try {
    const raw = await readFile(cachePath, 'utf-8');
    return parseCatalogJson(raw);
  } catch {
    return null;
  }
}

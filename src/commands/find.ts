/**
 * `skills find [query]` (alias: `search`) command.
 *
 * Searches the internal Git-hosted catalog (index.json).
 * Falls back to cached catalog when remote is unavailable.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runGit } from '../git/run-git.js';

export interface CatalogEntry {
  name: string;
  description: string;
  tags: string[];
  source_url: string;
  default_ref: string;
  path: string;
  owner_team: string;
}

function getCatalogCacheDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return join(home, '.cache', 'skills', 'catalog');
}

function getCatalogCachePath(): string {
  return join(getCatalogCacheDir(), 'index.json');
}

async function fetchCatalog(): Promise<CatalogEntry[] | null> {
  const catalogUrl = process.env.SKILLS_CATALOG_URL;
  if (!catalogUrl) {
    return null;
  }

  try {
    // Clone/fetch the catalog repo and read index.json
    const { cloneToCache } = await import('../git/cache.js');
    const repoDir = await cloneToCache(catalogUrl);
    const indexPath = join(repoDir, 'index.json');

    if (!existsSync(indexPath)) {
      return null;
    }

    const raw = await readFile(indexPath, 'utf-8');
    const data = JSON.parse(raw) as CatalogEntry[];

    // Cache locally
    const cacheDir = getCatalogCacheDir();
    if (!existsSync(cacheDir)) {
      await mkdir(cacheDir, { recursive: true });
    }
    await writeFile(getCatalogCachePath(), raw, 'utf-8');

    return data;
  } catch {
    return null;
  }
}

async function readCachedCatalog(): Promise<CatalogEntry[] | null> {
  const path = getCatalogCachePath();
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as CatalogEntry[];
  } catch {
    return null;
  }
}

export async function findCommand(query?: string): Promise<void> {
  // Try remote first, fall back to cache
  let catalog = await fetchCatalog();
  let fromCache = false;

  if (!catalog) {
    catalog = await readCachedCatalog();
    fromCache = true;

    if (!catalog) {
      if (!process.env.SKILLS_CATALOG_URL) {
        console.log('No catalog configured. Set SKILLS_CATALOG_URL to enable skill search.');
      } else {
        console.log('Catalog unavailable and no cache found.');
      }
      return;
    }

    console.log('(Using cached catalog - remote unavailable)\n');
  }

  // Filter by query
  let results = catalog;
  if (query) {
    const q = query.toLowerCase();
    results = catalog.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (results.length === 0) {
    console.log(query ? `No skills found matching "${query}".` : 'Catalog is empty.');
    return;
  }

  console.log(`Found ${results.length} skill(s):\n`);

  for (const entry of results) {
    const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
    console.log(`  ${entry.name}${tags}`);
    console.log(`    ${entry.description}`);
    console.log(`    Install: skills add ${entry.source_url}${entry.path ? `/${entry.path}` : ''}`);
    console.log();
  }
}

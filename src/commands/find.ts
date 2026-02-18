/**
 * `skills find [query]` (alias: `search`) command.
 *
 * Searches the internal Git-hosted catalog (index.json).
 * Falls back to cached catalog when remote is unavailable.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cloneToCache } from '../git/cache.js';
import {
  readCatalogCache,
  writeCatalogCache,
  isCacheStale,
} from '../catalog/index-provider.js';
import { parseCatalogJson, type CatalogEntry } from '../catalog/types.js';
import {
  assertDomainAllowed,
  isDomainAllowed,
} from '../policy/domain-allowlist.js';
import { emitAuditEvent } from '../audit/events.js';

interface FindOptions {
  json?: boolean;
}

type CatalogLoadResult =
  | { ok: true; catalog: CatalogEntry[]; fromCache: boolean; degraded: boolean }
  | { ok: false; error: string };

export async function findCommand(
  query?: string,
  options: FindOptions = {},
): Promise<number> {
  const log = (message: string): void => {
    if (options.json) {
      console.error(message);
    } else {
      console.log(message);
    }
  };

  const catalogUrl = process.env.SKILLS_CATALOG_URL;
  if (!catalogUrl) {
    console.error('No catalog configured. Set SKILLS_CATALOG_URL to enable skill search.');
    await emitAuditEvent('error', { command: 'find', reason: 'catalog_not_configured' });
    return 1;
  }

  try {
    assertDomainAllowed(catalogUrl);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    await emitAuditEvent('error', { command: 'find', reason: 'catalog_access_denied' });
    return 1;
  }

  let loaded: CatalogLoadResult;
  loaded = await loadCatalog(catalogUrl);

  if (!loaded.ok) {
    console.error(loaded.error);
    await emitAuditEvent('error', { command: 'find', reason: 'catalog_unavailable' });
    return 1;
  }

  if (loaded.degraded) {
    console.error('Warning: using cached catalog (remote unavailable).');
  }

  let results = loaded.catalog;
  if (query) {
    const q = query.toLowerCase();
    results = results.filter((entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  const safeResults = results.filter((entry) => isDomainAllowed(entry.source_url));
  const blockedCount = results.length - safeResults.length;
  if (blockedCount > 0) {
    console.error(`Warning: filtered ${blockedCount} catalog entr${blockedCount === 1 ? 'y' : 'ies'} from disallowed domains.`);
  }

  await emitAuditEvent('skill.find', {
    query: query || '',
    results: safeResults.length,
    from_cache: loaded.fromCache,
    degraded: loaded.degraded,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(safeResults, null, 2)}\n`);
    return 0;
  }

  if (safeResults.length === 0) {
    log(query ? `No skills found matching "${query}".` : 'Catalog is empty.');
    return 0;
  }

  log(`Found ${safeResults.length} skill(s):\n`);
  for (const entry of safeResults) {
    const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
    log(`  ${entry.name}${tags}`);
    log(`    ${entry.description}`);
    log(`    Install: skills add ${entry.source_url}${entry.path ? `/${entry.path}` : ''}`);
    log('');
  }

  return 0;
}

async function loadCatalog(catalogUrl: string): Promise<CatalogLoadResult> {
  const cache = await readCatalogCache(catalogUrl);
  const stale = await isCacheStale(catalogUrl);

  if (cache && !stale) {
    return { ok: true, catalog: cache, fromCache: true, degraded: false };
  }

  const fetched = await fetchCatalog(catalogUrl);
  if (fetched) {
    return { ok: true, catalog: fetched, fromCache: false, degraded: false };
  }

  if (cache) {
    return { ok: true, catalog: cache, fromCache: true, degraded: true };
  }

  return { ok: false, error: 'Catalog unavailable and no cache found.' };
}

async function fetchCatalog(catalogUrl: string): Promise<CatalogEntry[] | null> {
  try {
    const repoDir = await cloneToCache(catalogUrl);
    const indexPath = join(repoDir, 'index.json');
    if (!existsSync(indexPath)) {
      return null;
    }

    const raw = await readFile(indexPath, 'utf-8');
    const parsed = parseCatalogJson(raw);
    if (!parsed) {
      return null;
    }

    await writeCatalogCache(catalogUrl, parsed);
    return parsed;
  } catch {
    return null;
  }
}

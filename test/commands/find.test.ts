import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findCommand } from '../../src/commands/find.js';
import {
  readCatalogCache,
  writeCatalogCache,
} from '../../src/catalog/index-provider.js';

describe('findCommand', () => {
  let tempDir: string;
  let origHome: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-find-'));
    origHome = process.env.HOME || '';
    process.env.HOME = tempDir;
    delete process.env.SKILLS_CATALOG_URL;
  });

  afterEach(async () => {
    process.env.HOME = origHome;
    delete process.env.SKILLS_CATALOG_URL;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns non-zero when catalog is not configured', async () => {
    const code = await findCommand('test', { json: true });
    expect(code).toBe(1);
  });

  it('returns non-zero for disallowed catalog domain', async () => {
    process.env.SKILLS_CATALOG_URL = 'https://evil.com/catalog.git';
    const code = await findCommand('test', { json: true });
    expect(code).toBe(1);
  });

  it('still rejects disallowed domain when cache exists', async () => {
    const disallowedUrl = 'https://evil.com/catalog.git';
    await writeCatalogCache(disallowedUrl, [
      {
        name: 'cached-skill',
        description: 'cached',
        tags: [],
        source_url: 'https://github.com/org/repo',
        default_ref: 'main',
        path: '',
        owner_team: 'team',
      },
    ]);

    process.env.SKILLS_CATALOG_URL = disallowedUrl;
    const code = await findCommand('cached', { json: true });
    expect(code).toBe(1);
  });

  it('namespaces cache by catalog url', async () => {
    const urlA = 'https://github.com/org/catalog-a';
    const urlB = 'https://github.com/org/catalog-b';

    await writeCatalogCache(urlA, [
      {
        name: 'skill-a',
        description: 'a',
        tags: [],
        source_url: 'https://github.com/org/repo-a',
        default_ref: 'main',
        path: '',
        owner_team: 'team',
      },
    ]);
    await writeCatalogCache(urlB, [
      {
        name: 'skill-b',
        description: 'b',
        tags: [],
        source_url: 'https://github.com/org/repo-b',
        default_ref: 'main',
        path: '',
        owner_team: 'team',
      },
    ]);

    const cacheA = await readCatalogCache(urlA);
    const cacheB = await readCatalogCache(urlB);

    expect(cacheA?.[0]?.name).toBe('skill-a');
    expect(cacheB?.[0]?.name).toBe('skill-b');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readManifest,
  writeManifest,
  addToManifest,
  removeFromManifest,
  manifestKey,
  generateInstallId,
} from '../../src/state/install-manifest.js';
import {
  createEmptyManifest,
  validateManifest,
  migrateManifest,
  MANIFEST_SCHEMA_VERSION,
  type ManifestEntry,
} from '../../src/state/manifest-schema.js';

describe('manifest-schema', () => {
  it('creates empty manifest with correct version', () => {
    const manifest = createEmptyManifest();
    expect(manifest.schema_version).toBe(MANIFEST_SCHEMA_VERSION);
    expect(manifest.skills).toEqual({});
  });

  describe('validateManifest', () => {
    it('validates correct manifest', () => {
      const manifest = createEmptyManifest();
      expect(validateManifest(manifest)).toEqual([]);
    });

    it('rejects non-object', () => {
      expect(validateManifest(null)).toEqual(['Manifest must be a JSON object']);
      expect(validateManifest('string')).toEqual([
        'Manifest must be a JSON object',
      ]);
    });

    it('rejects wrong schema version', () => {
      const errors = validateManifest({ schema_version: 999, skills: {} });
      expect(errors).toContainEqual(
        expect.stringContaining('Expected schema_version'),
      );
    });

    it('validates entry fields', () => {
      const errors = validateManifest({
        schema_version: 1,
        skills: { bad: {} },
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('install_id'))).toBe(true);
      expect(errors.some((e) => e.includes('managed_root'))).toBe(true);
    });
  });

  describe('migrateManifest', () => {
    it('returns empty manifest for null', () => {
      expect(migrateManifest(null).schema_version).toBe(MANIFEST_SCHEMA_VERSION);
    });

    it('passes through v1 manifest', () => {
      const m = createEmptyManifest();
      m.skills['test'] = makeEntry('test');
      expect(migrateManifest(m)).toEqual(m);
    });

    it('throws for future schema versions', () => {
      expect(() =>
        migrateManifest({ schema_version: 99, skills: {} }),
      ).toThrow('Manifest schema version 99 is newer than supported version');
    });
  });
});

describe('install-manifest', () => {
  let tempDir: string;
  let origCwd: string;
  let origHome: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-test-'));
    origCwd = process.cwd();
    origHome = process.env.HOME || '';
    process.chdir(tempDir);
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.chdir(origCwd);
    process.env.HOME = origHome;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads empty manifest when file does not exist', async () => {
    const manifest = await readManifest('project');
    expect(manifest.schema_version).toBe(MANIFEST_SCHEMA_VERSION);
    expect(manifest.skills).toEqual({});
  });

  it('writes and reads manifest atomically', async () => {
    const manifest = createEmptyManifest();
    manifest.skills['test:project:my-skill'] = makeEntry('my-skill');

    await writeManifest('project', manifest);
    const read = await readManifest('project');

    expect(read.skills['test:project:my-skill'].skill_name).toBe('my-skill');
  });

  it('addToManifest creates entry', async () => {
    const entry = makeEntry('my-skill');
    await addToManifest('project', entry);

    const manifest = await readManifest('project');
    const key = manifestKey('roo', 'project', 'my-skill');
    expect(manifest.skills[key]).toBeDefined();
    expect(manifest.skills[key].skill_name).toBe('my-skill');
  });

  it('removeFromManifest deletes entry', async () => {
    const entry = makeEntry('my-skill');
    await addToManifest('project', entry);

    const key = manifestKey('roo', 'project', 'my-skill');
    const removed = await removeFromManifest('project', key);

    expect(removed).toBeDefined();
    expect(removed!.skill_name).toBe('my-skill');

    const manifest = await readManifest('project');
    expect(manifest.skills[key]).toBeUndefined();
  });

  it('generateInstallId returns unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateInstallId()));
    expect(ids.size).toBe(100);
  });

  it('manifestKey produces consistent keys', () => {
    expect(manifestKey('roo', 'project', 'my-skill')).toBe(
      'roo:project:my-skill',
    );
    expect(manifestKey('claude-code', 'user', 'test')).toBe(
      'claude-code:user:test',
    );
  });
});

function makeEntry(name: string): ManifestEntry {
  return {
    install_id: generateInstallId(),
    source_url: 'https://github.com/org/repo',
    source_type: 'git',
    resolved_commit: 'abc1234567890',
    ref: 'main',
    subpath: undefined,
    skill_name: name,
    skill_path: name,
    agent: 'roo',
    scope: 'project',
    managed_root: `/tmp/test/${name}`,
    installed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

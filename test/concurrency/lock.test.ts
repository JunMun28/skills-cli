import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readManifest,
  addToManifest,
  generateInstallId,
} from '../../src/state/install-manifest.js';
import type { ManifestEntry } from '../../src/state/manifest-schema.js';

describe('concurrent manifest operations', () => {
  let tempDir: string;
  let origCwd: string;
  let origHome: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-concurrent-'));
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

  it('handles concurrent addToManifest without data loss', async () => {
    // Simulate concurrent writes
    const promises = Array.from({ length: 10 }, (_, i) =>
      addToManifest('project', makeEntry(`skill-${i}`)),
    );

    await Promise.all(promises);

    const manifest = await readManifest('project');
    const count = Object.keys(manifest.skills).length;
    expect(count).toBe(10);
    expect(manifest.schema_version).toBe(1);
  });

  it('manifest file is valid JSON after multiple writes', async () => {
    for (let i = 0; i < 20; i++) {
      await addToManifest('project', makeEntry(`skill-${i}`));
    }

    const manifest = await readManifest('project');
    expect(Object.keys(manifest.skills).length).toBe(20);
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

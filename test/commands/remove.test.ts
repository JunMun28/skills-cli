import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeCommand } from '../../src/commands/remove.js';

describe('removeCommand', () => {
  let tempDir: string;
  let origCwd: string;
  let origHome: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-remove-'));
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

  it('refuses to delete managed_root outside allowed install roots', async () => {
    const outsideDir = join(tempDir, 'outside-target');
    await mkdir(outsideDir, { recursive: true });

    const manifest = {
      schema_version: 1,
      skills: {
        'roo:project:bad': {
          install_id: '1',
          source_url: 'https://github.com/org/repo',
          source_type: 'git',
          resolved_commit: 'abc123',
          ref: 'main',
          subpath: undefined,
          skill_name: 'bad',
          skill_path: 'bad',
          agent: 'roo',
          scope: 'project',
          managed_root: outsideDir,
          installed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    };

    await writeFile(
      join(tempDir, '.skills-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );

    const code = await removeCommand([], { all: true, yes: true });
    expect(code).toBe(1);
    expect(existsSync(outsideDir)).toBe(true);
  });
});

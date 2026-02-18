import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initCommand } from '../../src/commands/init.js';

describe('initCommand', () => {
  let tempDir: string;
  let origCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-init-'));
    origCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates skill directory with SKILL.md', async () => {
    await initCommand('test-skill');

    expect(existsSync(join(tempDir, 'test-skill'))).toBe(true);
    expect(existsSync(join(tempDir, 'test-skill', 'SKILL.md'))).toBe(true);
  });

  it('creates valid frontmatter', async () => {
    await initCommand('my-tool');

    const content = await readFile(
      join(tempDir, 'my-tool', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('name: my-tool');
    expect(content).toContain('description:');
  });

  it('uses default name when none provided', async () => {
    await initCommand(undefined);
    expect(existsSync(join(tempDir, 'my-skill'))).toBe(true);
  });
});

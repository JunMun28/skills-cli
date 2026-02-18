import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copySkill } from '../../src/install/copier.js';

describe('copySkill', () => {
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-copier-'));
    sourceDir = join(tempDir, 'source');
    targetDir = join(tempDir, 'target');
    await mkdir(sourceDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('copies skill files to target', async () => {
    await writeFile(join(sourceDir, 'SKILL.md'), '# Test');
    await writeFile(join(sourceDir, 'helper.ts'), 'export const x = 1;');

    const result = await copySkill(sourceDir, targetDir);

    expect(result.success).toBe(true);
    expect(result.filesCount).toBe(2);
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(targetDir, 'helper.ts'))).toBe(true);
  });

  it('preserves file content', async () => {
    const content = '---\nname: test\n---\n# Test Skill';
    await writeFile(join(sourceDir, 'SKILL.md'), content);

    await copySkill(sourceDir, targetDir);

    const read = await readFile(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(read).toBe(content);
  });

  it('creates parent directories', async () => {
    await writeFile(join(sourceDir, 'SKILL.md'), '# Test');
    const deepTarget = join(tempDir, 'deep', 'nested', 'target');

    const result = await copySkill(sourceDir, deepTarget);
    expect(result.success).toBe(true);
    expect(existsSync(join(deepTarget, 'SKILL.md'))).toBe(true);
  });

  it('overwrites existing target', async () => {
    await writeFile(join(sourceDir, 'SKILL.md'), '# New');
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'SKILL.md'), '# Old');

    const result = await copySkill(sourceDir, targetDir);
    expect(result.success).toBe(true);

    const content = await readFile(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(content).toBe('# New');
  });

  it('blocks dangerous file types', async () => {
    await writeFile(join(sourceDir, 'SKILL.md'), '# Test');
    await writeFile(join(sourceDir, 'payload.exe'), 'malware');

    const result = await copySkill(sourceDir, targetDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked file type');
  });

  it('copies subdirectories', async () => {
    await mkdir(join(sourceDir, 'sub'), { recursive: true });
    await writeFile(join(sourceDir, 'SKILL.md'), '# Test');
    await writeFile(join(sourceDir, 'sub', 'util.ts'), 'export {}');

    const result = await copySkill(sourceDir, targetDir);
    expect(result.success).toBe(true);
    expect(existsSync(join(targetDir, 'sub', 'util.ts'))).toBe(true);
  });
});

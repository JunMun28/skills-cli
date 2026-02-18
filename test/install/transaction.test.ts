import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeInstallTransaction } from '../../src/install/transaction.js';

describe('executeInstallTransaction', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-txn-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('installs multiple skills atomically', async () => {
    const source1 = join(tempDir, 'src1');
    const source2 = join(tempDir, 'src2');
    const target1 = join(tempDir, 'dst1');
    const target2 = join(tempDir, 'dst2');

    await mkdir(source1, { recursive: true });
    await mkdir(source2, { recursive: true });
    await writeFile(join(source1, 'SKILL.md'), '# S1');
    await writeFile(join(source2, 'SKILL.md'), '# S2');

    const result = await executeInstallTransaction([
      { sourcePath: source1, targetPath: target1 },
      { sourcePath: source2, targetPath: target2 },
    ]);

    expect(result.success).toBe(true);
    expect(result.installed).toHaveLength(2);
    expect(existsSync(join(target1, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(target2, 'SKILL.md'))).toBe(true);
  });

  it('rolls back on failure', async () => {
    const source1 = join(tempDir, 'src1');
    const source2 = join(tempDir, 'src2');
    const target1 = join(tempDir, 'dst1');
    const target2 = join(tempDir, 'dst2');

    await mkdir(source1, { recursive: true });
    await mkdir(source2, { recursive: true });
    await writeFile(join(source1, 'SKILL.md'), '# Good');
    await writeFile(join(source2, 'SKILL.md'), '# Bad');
    await writeFile(join(source2, 'evil.exe'), 'malware');

    const result = await executeInstallTransaction([
      { sourcePath: source1, targetPath: target1 },
      { sourcePath: source2, targetPath: target2 },
    ]);

    expect(result.success).toBe(false);
    // First install should be rolled back
    expect(existsSync(target1)).toBe(false);
  });
});

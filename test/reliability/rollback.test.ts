import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeInstallTransaction } from '../../src/install/transaction.js';

describe('rollback simulation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-rollback-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('rolls back all installs when one fails midway', async () => {
    const steps = [];

    // Create 3 valid sources and 1 invalid (with blocked file)
    for (let i = 0; i < 3; i++) {
      const src = join(tempDir, `src-${i}`);
      await mkdir(src, { recursive: true });
      await writeFile(join(src, 'SKILL.md'), `# Skill ${i}`);
      steps.push({
        sourcePath: src,
        targetPath: join(tempDir, `target-${i}`),
      });
    }

    // 4th source has blocked file
    const badSrc = join(tempDir, 'src-bad');
    await mkdir(badSrc, { recursive: true });
    await writeFile(join(badSrc, 'SKILL.md'), '# Bad');
    await writeFile(join(badSrc, 'malware.exe'), 'evil');
    steps.push({
      sourcePath: badSrc,
      targetPath: join(tempDir, 'target-bad'),
    });

    const result = await executeInstallTransaction(steps);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // All previous successful installs should be rolled back
    for (let i = 0; i < 3; i++) {
      expect(existsSync(join(tempDir, `target-${i}`))).toBe(false);
    }
  });

  it('succeeds when all installs are clean', async () => {
    const steps = [];

    for (let i = 0; i < 5; i++) {
      const src = join(tempDir, `src-${i}`);
      await mkdir(src, { recursive: true });
      await writeFile(join(src, 'SKILL.md'), `# Skill ${i}`);
      steps.push({
        sourcePath: src,
        targetPath: join(tempDir, `target-${i}`),
      });
    }

    const result = await executeInstallTransaction(steps);

    expect(result.success).toBe(true);
    expect(result.installed).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(existsSync(join(tempDir, `target-${i}`, 'SKILL.md'))).toBe(true);
    }
  });

  it('handles empty transaction', async () => {
    const result = await executeInstallTransaction([]);
    expect(result.success).toBe(true);
    expect(result.installed).toHaveLength(0);
  });
});

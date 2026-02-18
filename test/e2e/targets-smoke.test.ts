import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copySkill } from '../../src/install/copier.js';
import {
  getInstallPath,
  SUPPORTED_AGENTS,
  type AgentName,
  type Scope,
} from '../../src/install/targets.js';

describe('target-path smoke tests', () => {
  let tempDir: string;
  let origCwd: string;
  let origHome: string;
  let sourceDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-smoke-'));
    origCwd = process.cwd();
    origHome = process.env.HOME || '';
    process.chdir(tempDir);
    process.env.HOME = tempDir;

    // Create a source skill
    sourceDir = join(tempDir, '_source');
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      join(sourceDir, 'SKILL.md'),
      '---\nname: smoke-test\ndescription: Smoke test\n---\n# Smoke Test',
    );
  });

  afterEach(async () => {
    process.chdir(origCwd);
    process.env.HOME = origHome;
    await rm(tempDir, { recursive: true, force: true });
  });

  const scopes: Scope[] = ['project', 'user'];

  for (const agent of SUPPORTED_AGENTS) {
    for (const scope of scopes) {
      it(`installs to ${agent} ${scope} scope`, async () => {
        const targetPath = getInstallPath(agent, scope, 'smoke-test');
        const result = await copySkill(sourceDir, targetPath);

        expect(result.success).toBe(true);
        expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);

        const content = await readFile(join(targetPath, 'SKILL.md'), 'utf-8');
        expect(content).toContain('smoke-test');
      });
    }
  }
});

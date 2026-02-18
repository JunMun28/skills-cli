import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getInstallPath,
  getInstallRoot,
  getScanRoots,
  parseAgentNames,
  SUPPORTED_AGENTS,
} from '../../src/install/targets.js';

describe('targets', () => {
  let tempDir: string;
  let origCwd: string;
  let origHome: string;

  beforeEach(async () => {
    tempDir = await realpath(await mkdtemp(join(tmpdir(), 'skills-targets-')));
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

  describe('getInstallPath', () => {
    it('returns correct roo project path', () => {
      const path = getInstallPath('roo', 'project', 'my-skill');
      expect(path).toBe(join(tempDir, '.roo', 'skills', 'my-skill'));
    });

    it('returns correct roo user path', () => {
      const path = getInstallPath('roo', 'user', 'my-skill');
      expect(path).toBe(join(tempDir, '.roo', 'skills', 'my-skill'));
    });

    it('returns correct copilot project path (default)', () => {
      const path = getInstallPath('copilot', 'project', 'my-skill');
      expect(path).toBe(join(tempDir, '.agents', 'skills', 'my-skill'));
    });

    it('returns .github path when it already exists', async () => {
      await mkdir(join(tempDir, '.github', 'skills'), { recursive: true });
      const path = getInstallPath('copilot', 'project', 'my-skill');
      expect(path).toBe(join(tempDir, '.github', 'skills', 'my-skill'));
    });

    it('returns correct copilot user path', () => {
      const path = getInstallPath('copilot', 'user', 'my-skill');
      expect(path).toBe(join(tempDir, '.copilot', 'skills', 'my-skill'));
    });

    it('returns correct claude-code project path', () => {
      const path = getInstallPath('claude-code', 'project', 'my-skill');
      expect(path).toBe(join(tempDir, '.codex', 'skills', 'my-skill'));
    });

    it('returns correct claude-code user path', () => {
      const path = getInstallPath('claude-code', 'user', 'my-skill');
      expect(path).toBe(join(tempDir, '.codex', 'skills', 'my-skill'));
    });
  });

  describe('getScanRoots', () => {
    it('returns both copilot project roots', () => {
      const roots = getScanRoots('copilot', 'project');
      expect(roots).toHaveLength(2);
      expect(roots[0]).toContain('.agents');
      expect(roots[1]).toContain('.github');
    });

    it('returns single root for other agents', () => {
      expect(getScanRoots('roo', 'project')).toHaveLength(1);
      expect(getScanRoots('claude-code', 'user')).toHaveLength(1);
    });
  });

  describe('parseAgentNames', () => {
    it('returns all agents for undefined input', () => {
      expect(parseAgentNames(undefined)).toEqual(SUPPORTED_AGENTS);
    });

    it('parses comma-separated agents', () => {
      expect(parseAgentNames('roo,copilot')).toEqual(['roo', 'copilot']);
    });

    it('ignores unknown agents', () => {
      expect(parseAgentNames('roo,unknown')).toEqual(['roo']);
    });

    it('handles whitespace', () => {
      expect(parseAgentNames(' roo , copilot ')).toEqual(['roo', 'copilot']);
    });
  });
});

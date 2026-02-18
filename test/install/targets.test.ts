import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getInstallPath,
  getInstallRoot,
  getScanRoots,
  parseAgentNames,
  parseAgentSelection,
  SUPPORTED_AGENTS,
} from '../../src/install/targets.ts';

describe('targets (expanded agents)', () => {
  let tempDir: string;
  let origCwd: string;

  beforeEach(async () => {
    tempDir = await realpath(await mkdtemp(join(tmpdir(), 'skills-targets-')));
    origCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolves project path for claude-code', () => {
    const path = getInstallPath('claude-code', 'project', 'my-skill');
    expect(path).toBe(join(tempDir, '.claude', 'skills', 'my-skill'));
  });

  it('resolves project path for github-copilot', () => {
    const path = getInstallPath('github-copilot', 'project', 'my-skill');
    expect(path).toBe(join(tempDir, '.agents', 'skills', 'my-skill'));
  });

  it('resolves user root with configured global path', () => {
    const root = getInstallRoot('roo', 'user');
    expect(root).toContain('.roo');
    expect(root).toContain('skills');
  });

  it('returns scan roots including canonical root', () => {
    const roots = getScanRoots('claude-code', 'project');
    expect(roots.some((root) => root.endsWith(join('.claude', 'skills')))).toBe(true);
    expect(roots.some((root) => root.endsWith(join('.agents', 'skills')))).toBe(true);
  });

  it('parses all agents when undefined', () => {
    expect(parseAgentNames(undefined)).toEqual(SUPPORTED_AGENTS);
  });

  it('parses alias copilot -> github-copilot', () => {
    expect(parseAgentNames('copilot')).toEqual(['github-copilot']);
  });

  it('handles wildcard and invalid names', () => {
    const wildcard = parseAgentSelection('*');
    expect(wildcard.agents).toEqual(SUPPORTED_AGENTS);

    const mixed = parseAgentSelection('roo,unknown');
    expect(mixed.agents).toEqual(['roo']);
    expect(mixed.invalid).toEqual(['unknown']);
  });
});

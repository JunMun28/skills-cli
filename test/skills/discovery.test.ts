import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverSkills, parseFrontmatter } from '../../src/skills/discovery.ts';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter', () => {
    const content = `---
name: my-skill
description: A test skill
---

# My Skill`;
    const frontmatter = parseFrontmatter(content);
    expect(frontmatter.name).toBe('my-skill');
    expect(frontmatter.description).toBe('A test skill');
  });

  it('returns empty when missing frontmatter', () => {
    expect(parseFrontmatter('# content')).toEqual({});
  });
});

describe('discoverSkills (priority + strict metadata)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-discovery-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.INSTALL_INTERNAL_SKILLS;
  });

  it('discovers valid skills', async () => {
    await mkdir(join(tempDir, 'skills', 'good'), { recursive: true });
    await writeFile(
      join(tempDir, 'skills', 'good', 'SKILL.md'),
      '---\nname: good\ndescription: Valid skill\n---\n',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('good');
  });

  it('rejects subpaths that escape root', async () => {
    await expect(discoverSkills(tempDir, '../outside')).rejects.toThrow(
      'Subpath escapes repository root',
    );
  });

  it('skips skills missing required metadata', async () => {
    await mkdir(join(tempDir, 'skills', 'invalid'), { recursive: true });
    await writeFile(
      join(tempDir, 'skills', 'invalid', 'SKILL.md'),
      '---\ndescription: missing name\n---\n',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills).toHaveLength(0);
  });

  it('hides internal skills by default', async () => {
    await mkdir(join(tempDir, 'skills', 'internal-one'), { recursive: true });
    await writeFile(
      join(tempDir, 'skills', 'internal-one', 'SKILL.md'),
      '---\nname: internal-one\ndescription: hidden\nmetadata:\n  internal: true\n---\n',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills).toHaveLength(0);
  });

  it('shows internal skills when INSTALL_INTERNAL_SKILLS=1', async () => {
    process.env.INSTALL_INTERNAL_SKILLS = '1';
    await mkdir(join(tempDir, 'skills', 'internal-one'), { recursive: true });
    await writeFile(
      join(tempDir, 'skills', 'internal-one', 'SKILL.md'),
      '---\nname: internal-one\ndescription: visible\nmetadata:\n  internal: true\n---\n',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills.map((skill) => skill.name)).toContain('internal-one');
  });

  it('discovers plugin-manifest declared skill paths', async () => {
    await mkdir(join(tempDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ skills: ['./plugin-skills/my-plugin-skill'] }),
      'utf-8',
    );
    await mkdir(join(tempDir, 'plugin-skills', 'my-plugin-skill'), { recursive: true });
    await writeFile(
      join(tempDir, 'plugin-skills', 'my-plugin-skill', 'SKILL.md'),
      '---\nname: plugin-skill\ndescription: via plugin manifest\n---\n',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills.map((skill) => skill.name)).toContain('plugin-skill');
  });

  it('supports full-depth search when root has SKILL.md', async () => {
    await writeFile(
      join(tempDir, 'SKILL.md'),
      '---\nname: root-skill\ndescription: root\n---\n',
    );
    await mkdir(join(tempDir, 'nested', 'second'), { recursive: true });
    await writeFile(
      join(tempDir, 'nested', 'second', 'SKILL.md'),
      '---\nname: nested-skill\ndescription: nested\n---\n',
    );

    const defaultSkills = await discoverSkills(tempDir);
    expect(defaultSkills.map((skill) => skill.name)).toEqual(['root-skill']);

    const fullDepthSkills = await discoverSkills(tempDir, undefined, { fullDepth: true });
    expect(fullDepthSkills.map((skill) => skill.name).sort()).toEqual([
      'nested-skill',
      'root-skill',
    ]);
  });
});

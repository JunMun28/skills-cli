import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverSkills, parseFrontmatter } from '../../src/skills/discovery.js';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter', () => {
    const content = `---
name: my-skill
description: A test skill
---

# My Skill
Content here`;

    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.name).toBe('my-skill');
    expect(frontmatter.description).toBe('A test skill');
    expect(body).toContain('# My Skill');
  });

  it('handles missing frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('# Just content');
    expect(frontmatter).toEqual({});
    expect(body).toBe('# Just content');
  });

  it('handles quoted values', () => {
    const { frontmatter } = parseFrontmatter('---\nname: "quoted-name"\n---\n');
    expect(frontmatter.name).toBe('quoted-name');
  });

  it('handles boolean values', () => {
    const { frontmatter } = parseFrontmatter('---\ninternal: true\n---\n');
    expect(frontmatter.internal).toBe(true);
  });
});

describe('discoverSkills', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skills-discovery-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('discovers SKILL.md files', async () => {
    await mkdir(join(tempDir, 'my-skill'), { recursive: true });
    await writeFile(
      join(tempDir, 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: Test\n---\n# Skill',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-skill');
  });

  it('discovers multiple skills', async () => {
    for (const name of ['skill-a', 'skill-b', 'skill-c']) {
      await mkdir(join(tempDir, name), { recursive: true });
      await writeFile(
        join(tempDir, name, 'SKILL.md'),
        `---\nname: ${name}\ndescription: Test ${name}\n---\n`,
      );
    }

    const skills = await discoverSkills(tempDir);
    expect(skills).toHaveLength(3);
  });

  it('respects subpath filter', async () => {
    await mkdir(join(tempDir, 'skills', 'a'), { recursive: true });
    await mkdir(join(tempDir, 'other', 'b'), { recursive: true });
    await writeFile(
      join(tempDir, 'skills', 'a', 'SKILL.md'),
      '---\nname: a\ndescription: Test\n---\n',
    );
    await writeFile(
      join(tempDir, 'other', 'b', 'SKILL.md'),
      '---\nname: b\ndescription: Test\n---\n',
    );

    const skills = await discoverSkills(tempDir, 'skills');
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('a');
  });

  it('returns empty for dir with no SKILL.md', async () => {
    await mkdir(join(tempDir, 'empty'), { recursive: true });
    const skills = await discoverSkills(tempDir);
    expect(skills).toHaveLength(0);
  });

  it('falls back to directory name when no frontmatter name', async () => {
    await mkdir(join(tempDir, 'fallback-skill'), { recursive: true });
    await writeFile(
      join(tempDir, 'fallback-skill', 'SKILL.md'),
      '---\ndescription: No name field\n---\n',
    );

    const skills = await discoverSkills(tempDir);
    expect(skills[0].name).toBe('fallback-skill');
  });
});

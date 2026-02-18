import { describe, it, expect } from 'vitest';
import { parseSource } from '../../src/source/parse-source.ts';

describe('parseSource (v2)', () => {
  it('parses local path', () => {
    const result = parseSource('./skills');
    expect(result.type).toBe('local');
    expect(result.localPath).toBeDefined();
  });

  it('parses direct SKILL.md URL', () => {
    const result = parseSource('https://docs.example.com/path/skill.md');
    expect(result.type).toBe('direct-url');
    expect(result.url).toBe('https://docs.example.com/path/skill.md');
  });

  it('parses well-known endpoint URL', () => {
    const result = parseSource('https://docs.example.com/platform');
    expect(result.type).toBe('well-known');
    expect(result.url).toBe('https://docs.example.com/platform');
  });

  it('parses gitlab tree URL with subpath', () => {
    const result = parseSource('https://gitlab.com/group/sub/repo/-/tree/main/skills/my-skill');
    expect(result.type).toBe('gitlab');
    expect(result.ref).toBe('main');
    expect(result.subpath).toBe('skills/my-skill');
  });

  it('parses owner/repo@skill syntax', () => {
    const result = parseSource('vercel-labs/skills@find-skills');
    expect(result.type).toBe('github');
    expect(result.skillFilter).toBe('find-skills');
  });
});

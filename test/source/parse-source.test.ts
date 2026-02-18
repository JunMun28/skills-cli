import { describe, it, expect } from 'vitest';
import { parseSource } from '../../src/source/parse-source.js';

describe('parseSource', () => {
  describe('HTTPS URLs', () => {
    it('parses plain HTTPS URL', () => {
      const result = parseSource('https://github.com/org/repo');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBeUndefined();
      expect(result.subpath).toBeUndefined();
    });

    it('strips .git suffix', () => {
      const result = parseSource('https://github.com/org/repo.git');
      expect(result.url).toBe('https://github.com/org/repo');
    });

    it('strips trailing slashes', () => {
      const result = parseSource('https://github.com/org/repo/');
      expect(result.url).toBe('https://github.com/org/repo');
    });

    it('parses /tree/ URL with ref', () => {
      const result = parseSource('https://github.com/org/repo/tree/main');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBe('main');
      expect(result.subpath).toBeUndefined();
    });

    it('parses /tree/ URL with ref and subpath', () => {
      const result = parseSource(
        'https://github.com/org/repo/tree/main/skills/my-skill',
      );
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBe('main');
      expect(result.subpath).toBe('skills/my-skill');
    });
  });

  describe('SSH URLs', () => {
    it('parses SSH URL', () => {
      const result = parseSource('git@github.com:org/repo.git');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBeUndefined();
    });

    it('parses SSH URL with #ref', () => {
      const result = parseSource('git@github.com:org/repo.git#develop');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBe('develop');
    });
  });

  describe('shorthand', () => {
    it('parses org/repo', () => {
      const result = parseSource('org/repo');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBeUndefined();
      expect(result.subpath).toBeUndefined();
    });

    it('parses org/repo@ref', () => {
      const result = parseSource('org/repo@v1.0');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBe('v1.0');
      expect(result.subpath).toBeUndefined();
    });

    it('parses org/repo@ref/subpath', () => {
      const result = parseSource('org/repo@main/skills/my-skill');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBe('main');
      expect(result.subpath).toBe('skills/my-skill');
    });

    it('parses org/repo/subpath (no ref)', () => {
      const result = parseSource('org/repo/skills/my-skill');
      expect(result.url).toBe('https://github.com/org/repo');
      expect(result.ref).toBeUndefined();
      expect(result.subpath).toBe('skills/my-skill');
    });

    it('throws on single segment', () => {
      expect(() => parseSource('just-a-name')).toThrow('Invalid source');
    });
  });

  it('preserves raw input', () => {
    const raw = 'org/repo@main';
    expect(parseSource(raw).raw).toBe(raw);
  });

  it('trims whitespace', () => {
    const result = parseSource('  org/repo  ');
    expect(result.url).toBe('https://github.com/org/repo');
  });
});

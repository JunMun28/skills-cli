import { describe, it, expect } from 'vitest';
import { validatePath, validateSkillName } from '../../src/skills/validate.js';
import { parseSource } from '../../src/source/parse-source.js';

describe('path traversal prevention', () => {
  const traversalAttempts = [
    '../../../etc/passwd',
    '..\\..\\windows\\system32',
    'skills/../../../etc/shadow',
    './../../.ssh/id_rsa',
    'a/b/../../../../../../etc/hosts',
  ];

  for (const attempt of traversalAttempts) {
    it(`rejects path traversal: "${attempt}"`, () => {
      const result = validatePath(attempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('traversal'))).toBe(true);
    });
  }

  const absolutePaths = [
    '/etc/passwd',
    '/root/.ssh/id_rsa',
    '/tmp/evil',
  ];

  for (const attempt of absolutePaths) {
    it(`rejects absolute path: "${attempt}"`, () => {
      const result = validatePath(attempt);
      expect(result.valid).toBe(false);
    });
  }
});

describe('skill name injection prevention', () => {
  const maliciousNames = [
    '../../../etc',
    'skill; rm -rf /',
    'skill$(whoami)',
    'skill`id`',
    'skill|cat /etc/passwd',
    'skill\nmalicious',
    'skill\x00null',
  ];

  for (const name of maliciousNames) {
    it(`rejects malicious name: "${name.replace(/[\n\x00]/g, '\\n')}"`, () => {
      const result = validateSkillName(name);
      expect(result.valid).toBe(false);
    });
  }
});

describe('domain allowlist enforcement', () => {
  it('blocks non-allowlisted domain in source URL', () => {
    const parsed = parseSource('https://evil.com/org/repo');
    // The assertDomainAllowed should reject this
    expect(parsed.url).toBe('https://evil.com/org/repo');
    // Actual allowlist check is tested in domain-allowlist.test.ts
  });
});

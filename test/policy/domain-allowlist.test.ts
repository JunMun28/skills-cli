import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isDomainAllowed,
  assertDomainAllowed,
  getAllowedDomains,
  resetAllowlistCache,
} from '../../src/policy/domain-allowlist.js';

describe('domain-allowlist', () => {
  beforeEach(() => {
    resetAllowlistCache();
    delete process.env.SKILLS_ALLOWED_DOMAINS;
  });

  afterEach(() => {
    resetAllowlistCache();
    delete process.env.SKILLS_ALLOWED_DOMAINS;
  });

  describe('default domains', () => {
    it('allows github.com', () => {
      expect(isDomainAllowed('https://github.com/org/repo')).toBe(true);
    });

    it('allows gitlab.com', () => {
      expect(isDomainAllowed('https://gitlab.com/org/repo')).toBe(true);
    });

    it('allows bitbucket.org', () => {
      expect(isDomainAllowed('https://bitbucket.org/org/repo')).toBe(true);
    });

    it('rejects unknown domains', () => {
      expect(isDomainAllowed('https://evil.com/org/repo')).toBe(false);
    });

    it('allows subdomains of allowed domains', () => {
      expect(isDomainAllowed('https://enterprise.github.com/org/repo')).toBe(
        true,
      );
    });
  });

  describe('custom domains via env', () => {
    it('respects SKILLS_ALLOWED_DOMAINS', () => {
      process.env.SKILLS_ALLOWED_DOMAINS = 'internal-git.company.com,git.corp.io';
      resetAllowlistCache();

      expect(isDomainAllowed('https://internal-git.company.com/org/repo')).toBe(
        true,
      );
      expect(isDomainAllowed('https://git.corp.io/org/repo')).toBe(true);
      expect(isDomainAllowed('https://github.com/org/repo')).toBe(false);
    });
  });

  describe('assertDomainAllowed', () => {
    it('does not throw for allowed domains', () => {
      expect(() =>
        assertDomainAllowed('https://github.com/org/repo'),
      ).not.toThrow();
    });

    it('throws for disallowed domains', () => {
      expect(() =>
        assertDomainAllowed('https://evil.com/org/repo'),
      ).toThrow('Domain not in allowlist');
    });
  });

  describe('edge cases', () => {
    it('handles invalid URLs', () => {
      expect(isDomainAllowed('not-a-url')).toBe(false);
    });

    it('handles empty string', () => {
      expect(isDomainAllowed('')).toBe(false);
    });
  });
});

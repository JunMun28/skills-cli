import { describe, it, expect } from 'vitest';
import { checkEntry } from '../../src/commands/check.js';
import type { CheckStatus } from '../../src/commands/check.js';

describe('check status codes', () => {
  it('returns "missing" when managed_root does not exist', async () => {
    const result = await checkEntry('key', {
      skill_name: 'test',
      agent: 'roo',
      source_url: 'https://github.com/org/repo',
      resolved_commit: 'abc123',
      ref: 'main',
      managed_root: '/nonexistent/path',
    });

    expect(result.status).toBe('missing' satisfies CheckStatus);
  });

  it('returns "policy_violation" for disallowed domain', async () => {
    // Use a domain that is NOT in the default allowlist
    const result = await checkEntry('key', {
      skill_name: 'test',
      agent: 'roo',
      source_url: 'https://evil-domain.example.com/org/repo',
      resolved_commit: 'abc123',
      ref: 'main',
      managed_root: '/tmp', // exists
    });

    expect(result.status).toBe('policy_violation' satisfies CheckStatus);
  });
});

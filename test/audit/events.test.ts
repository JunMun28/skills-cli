import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  emitAuditEvent,
  addAuditListener,
  clearAuditListeners,
  type AuditEvent,
} from '../../src/audit/events.js';

describe('audit events', () => {
  beforeEach(() => {
    clearAuditListeners();
    delete process.env.SKILLS_AUDIT_LOG;
  });

  afterEach(() => {
    clearAuditListeners();
    delete process.env.SKILLS_AUDIT_LOG;
  });

  it('notifies listeners', async () => {
    const events: AuditEvent[] = [];
    addAuditListener((e) => events.push(e));

    await emitAuditEvent('skill.add', { skill: 'test', agent: 'roo' });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('skill.add');
    expect(events[0].data.skill).toBe('test');
    expect(events[0].timestamp).toBeTruthy();
  });

  it('handles listener errors gracefully', async () => {
    addAuditListener(() => {
      throw new Error('boom');
    });

    const events: AuditEvent[] = [];
    addAuditListener((e) => events.push(e));

    await emitAuditEvent('skill.remove', { skill: 'test' });

    // Second listener should still receive the event
    expect(events).toHaveLength(1);
  });

  it('writes to audit log file when configured', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'skills-audit-'));
    const logPath = join(tempDir, 'audit.log');
    process.env.SKILLS_AUDIT_LOG = logPath;

    await emitAuditEvent('skill.add', { skill: 'test' });
    await emitAuditEvent('skill.remove', { skill: 'test' });

    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const event1 = JSON.parse(lines[0]);
    expect(event1.type).toBe('skill.add');

    const event2 = JSON.parse(lines[1]);
    expect(event2.type).toBe('skill.remove');

    await rm(tempDir, { recursive: true, force: true });
  });
});

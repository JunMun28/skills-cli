/**
 * Audit event hooks.
 *
 * Emits structured events for telemetry and audit logging.
 * Consumers can subscribe via addListener() or set SKILLS_AUDIT_LOG
 * to write events to a file.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

export type AuditEventType =
  | 'skill.add'
  | 'skill.remove'
  | 'skill.update'
  | 'skill.check'
  | 'skill.find'
  | 'skill.init'
  | 'policy.violation'
  | 'error';

export interface AuditEvent {
  type: AuditEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

type AuditListener = (event: AuditEvent) => void;

const listeners: AuditListener[] = [];

export function addAuditListener(listener: AuditListener): void {
  listeners.push(listener);
}

export function removeAuditListener(listener: AuditListener): void {
  const idx = listeners.indexOf(listener);
  if (idx !== -1) listeners.splice(idx, 1);
}

export function clearAuditListeners(): void {
  listeners.length = 0;
}

export async function emitAuditEvent(
  type: AuditEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const event: AuditEvent = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  // Notify listeners
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Don't let listener errors break the flow
    }
  }

  // Write to audit log file if configured
  const logPath = process.env.SKILLS_AUDIT_LOG;
  const resolvedLogPath = logPath ? resolveAuditLogPath(logPath) : null;
  if (resolvedLogPath) {
    try {
      const dir = dirname(resolvedLogPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      await appendFile(resolvedLogPath, JSON.stringify(event) + '\n', 'utf-8');
    } catch {
      // Don't fail on audit log write errors
    }
  }
}

function resolveAuditLogPath(path: string): string | null {
  if (!isAbsolute(path)) {
    return null;
  }

  if (path.split(/[\\/]/).includes('..')) {
    return null;
  }

  const resolvedPath = resolve(path);
  const allowedRoots = getAllowedAuditRoots();
  if (!allowedRoots.some((root) => isWithinRoot(resolvedPath, root))) {
    return null;
  }

  return resolvedPath;
}

function getAllowedAuditRoots(): string[] {
  const roots = new Set<string>();
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    roots.add(resolve(home));
  }
  roots.add(resolve(tmpdir()));

  const configured = process.env.SKILLS_AUDIT_LOG_DIR;
  if (configured && isAbsolute(configured)) {
    roots.add(resolve(configured));
  }

  return [...roots];
}

function isWithinRoot(path: string, root: string): boolean {
  if (path === root) {
    return true;
  }
  return path.startsWith(`${root}${sep}`);
}

/**
 * Install transaction: temp dir -> validate -> commit.
 *
 * Provides rollback-safe install flow by staging all changes
 * before committing them to the filesystem.
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { copySkill, type CopyResult } from './copier.js';

export interface InstallStep {
  sourcePath: string;
  targetPath: string;
}

export interface TransactionResult {
  success: boolean;
  installed: CopyResult[];
  errors: string[];
}

/**
 * Execute a batch of install steps atomically:
 * all succeed or all are rolled back.
 */
export async function executeInstallTransaction(
  steps: InstallStep[],
): Promise<TransactionResult> {
  const results: CopyResult[] = [];
  const errors: string[] = [];

  for (const step of steps) {
    const result = await copySkill(step.sourcePath, step.targetPath);
    results.push(result);

    if (!result.success) {
      errors.push(
        `Failed to install to ${step.targetPath}: ${result.error || 'unknown error'}`,
      );

      // Rollback previously installed steps
      for (const prev of results) {
        if (prev.success) {
          try {
            await rm(prev.targetPath, { recursive: true, force: true });
          } catch {
            // Best-effort rollback
          }
        }
      }

      return { success: false, installed: results, errors };
    }
  }

  return { success: true, installed: results, errors };
}

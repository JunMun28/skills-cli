/**
 * Copy installer - copies skill files to target directories.
 *
 * Uses a staged approach: copy to temp dir first, then move to final location.
 */

import { cp, mkdir, rm, rename, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { hasBlockedFileType } from '../skills/validate.js';

export interface CopyResult {
  success: boolean;
  filesCount: number;
  targetPath: string;
  error?: string;
}

/**
 * Copy a skill directory to the target path using staged install.
 * 1. Copy to temp staging dir
 * 2. Validate no blocked files
 * 3. Move to final target
 */
export async function copySkill(
  sourcePath: string,
  targetPath: string,
): Promise<CopyResult> {
  const stagingDir = join(tmpdir(), `skills-install-${randomUUID()}`);

  try {
    // Stage: copy to temp
    await mkdir(stagingDir, { recursive: true });
    await cp(sourcePath, stagingDir, { recursive: true, dereference: false });

    // Validate staged files
    const files = await listFilesRecursive(stagingDir);
    const blocked = files.filter((f) => hasBlockedFileType(f));
    if (blocked.length > 0) {
      return {
        success: false,
        filesCount: 0,
        targetPath,
        error: `Blocked file types found: ${blocked.join(', ')}`,
      };
    }

    // Commit: ensure parent dir exists, remove existing, move staged to final
    const parentDir = dirname(targetPath);
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }

    if (existsSync(targetPath)) {
      await rm(targetPath, { recursive: true, force: true });
    }

    await rename(stagingDir, targetPath);

    return {
      success: true,
      filesCount: files.length,
      targetPath,
    };
  } catch (err) {
    // Cleanup staging on failure
    try {
      await rm(stagingDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }

    return {
      success: false,
      filesCount: 0,
      targetPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symlinks not allowed in skill packages: ${fullPath}`);
    }

    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursive(fullPath);
      results.push(...subFiles);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

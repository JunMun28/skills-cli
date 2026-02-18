/**
 * Skill name/path validation and sanitization.
 */

import { basename, normalize, isAbsolute } from 'node:path';

// Dangerous file extensions that should not be installed
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.dylib', '.so', '.bat', '.cmd', '.com',
  '.msi', '.scr', '.pif', '.vbs', '.js.map',
]);

// Characters not allowed in skill names
const UNSAFE_NAME_RE = /[^a-z0-9_-]/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSkillName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name) {
    errors.push('Skill name is required');
    return { valid: false, errors };
  }

  if (name.length > 128) {
    errors.push('Skill name must be 128 characters or fewer');
  }

  if (UNSAFE_NAME_RE.test(name)) {
    errors.push(
      `Skill name "${name}" contains invalid characters. Use only lowercase letters, numbers, hyphens, and underscores.`,
    );
  }

  if (name.startsWith('-') || name.startsWith('_')) {
    errors.push('Skill name must not start with a hyphen or underscore');
  }

  if (name === '.' || name === '..') {
    errors.push('Skill name must not be "." or ".."');
  }

  return { valid: errors.length === 0, errors };
}

export function validatePath(path: string): ValidationResult {
  const errors: string[] = [];
  const normalized = normalize(path);

  // Block path traversal
  if (normalized.includes('..')) {
    errors.push(`Path traversal detected: "${path}"`);
  }

  // Block absolute paths in subpath context
  if (isAbsolute(path)) {
    errors.push(`Absolute paths not allowed: "${path}"`);
  }

  return { valid: errors.length === 0, errors };
}

export function hasBlockedFileType(filename: string): boolean {
  const lower = filename.toLowerCase();
  return Array.from(BLOCKED_EXTENSIONS).some((ext) => lower.endsWith(ext));
}

export function validateSkillFiles(filenames: string[]): ValidationResult {
  const errors: string[] = [];

  for (const file of filenames) {
    if (hasBlockedFileType(file)) {
      errors.push(`Blocked file type: "${file}"`);
    }

    const name = basename(file);
    if (name.startsWith('.') && name !== '.gitkeep') {
      // Allow .gitkeep but flag other hidden files
      // (not blocking - just informational)
    }
  }

  return { valid: errors.length === 0, errors };
}

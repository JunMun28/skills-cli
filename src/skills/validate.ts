/**
 * Skill name/path validation and sanitization.
 */

import { normalize, isAbsolute } from 'node:path';

// Dangerous file extensions that should not be installed
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.dylib', '.so', '.bat', '.cmd', '.com',
  '.msi', '.scr', '.pif', '.vbs', '.js', '.cjs', '.mjs',
  '.sh', '.py', '.rb', '.pl',
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
  const decodedPath = decodePath(path);
  const decodedUnix = decodedPath.replace(/\\/g, '/');
  const decodedSegments = decodedUnix.split('/').filter(Boolean);
  const normalized = normalize(decodedPath);
  const normalizedUnix = normalized.replace(/\\/g, '/');

  // Block path traversal
  if (decodedSegments.includes('..')) {
    errors.push(`Path traversal detected: "${path}"`);
  }

  const segments = normalizedUnix.split('/').filter(Boolean);
  if (!errors.some((error) => error.includes('traversal')) && segments.includes('..')) {
    errors.push(`Path traversal detected: "${path}"`);
  }

  // Block absolute paths in subpath context
  if (isAbsolute(decodedPath)) {
    errors.push(`Absolute paths not allowed: "${path}"`);
  }

  if (decodedPath.includes('\0')) {
    errors.push(`Null byte not allowed in path: "${path}"`);
  }

  return { valid: errors.length === 0, errors };
}

export function hasBlockedFileType(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) {
    return false;
  }
  return BLOCKED_EXTENSIONS.has(lower.slice(dotIdx));
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

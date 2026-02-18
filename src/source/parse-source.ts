/**
 * Compatibility parser wrapper.
 * Keeps legacy import path while exposing new source parser contract.
 */

import {
  parseSource as parseSourceV2,
  getOwnerRepo,
  parseOwnerRepo,
  isRepoPrivate,
} from '../source-parser.ts';

export interface ParsedSource {
  type: 'github' | 'gitlab' | 'git' | 'local' | 'direct-url' | 'well-known';
  url: string;
  subpath?: string;
  localPath?: string;
  ref?: string;
  skillFilter?: string;
  raw: string;
}

export function parseSource(source: string): ParsedSource {
  const parsed = parseSourceV2(source);
  return {
    ...parsed,
    raw: source.trim(),
  };
}

export { getOwnerRepo, parseOwnerRepo, isRepoPrivate };

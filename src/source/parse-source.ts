/**
 * Parses a Git URL or subpath source string into a normalized structure.
 *
 * Supported formats:
 *   https://github.com/org/repo
 *   https://github.com/org/repo/tree/main/skills/my-skill
 *   git@github.com:org/repo.git
 *   git@github.com:org/repo.git#branch
 *   org/repo (shorthand for github.com)
 *   org/repo@ref
 *   org/repo/subpath
 *   org/repo@ref/subpath
 */

export interface ParsedSource {
  /** Normalized clone URL (https) */
  url: string;
  /** Git ref (branch, tag, or commit SHA). Undefined means default branch. */
  ref: string | undefined;
  /** Subpath within the repo to look for skills */
  subpath: string | undefined;
  /** Original raw input */
  raw: string;
}

const HTTPS_URL_RE = /^https?:\/\//;
const SSH_URL_RE = /^git@([^:]+):(.+?)(?:\.git)?(?:#(.+))?$/;
const TREE_PATH_RE = /\/tree\/([^/]+)(?:\/(.+))?$/;

export function parseSource(source: string): ParsedSource {
  const raw = source.trim();

  // HTTPS URL with /tree/ path (e.g., github.com/org/repo/tree/main/subpath)
  if (HTTPS_URL_RE.test(raw)) {
    return parseHttpsUrl(raw);
  }

  // SSH URL (e.g., git@github.com:org/repo.git)
  const sshMatch = raw.match(SSH_URL_RE);
  if (sshMatch) {
    return parseSshUrl(raw, sshMatch);
  }

  // Shorthand: org/repo[@ref][/subpath]
  return parseShorthand(raw);
}

function parseHttpsUrl(raw: string): ParsedSource {
  const treeMatch = raw.match(TREE_PATH_RE);
  if (treeMatch) {
    const baseUrl = raw.slice(0, raw.indexOf('/tree/'));
    return {
      url: normalizeUrl(baseUrl),
      ref: treeMatch[1],
      subpath: treeMatch[2] || undefined,
      raw,
    };
  }

  // Plain HTTPS URL, possibly with .git suffix
  const url = normalizeUrl(raw);
  return { url, ref: undefined, subpath: undefined, raw };
}

function parseSshUrl(
  raw: string,
  match: RegExpMatchArray,
): ParsedSource {
  const host = match[1];
  const path = match[2];
  const ref = match[3] || undefined;
  const url = `https://${host}/${path}`;
  return { url: normalizeUrl(url), ref, subpath: undefined, raw };
}

function parseShorthand(raw: string): ParsedSource {
  // Split off @ref if present: org/repo@ref/subpath
  let remaining = raw;
  let ref: string | undefined;

  const atIdx = remaining.indexOf('@');
  if (atIdx !== -1) {
    const afterAt = remaining.slice(atIdx + 1);
    remaining = remaining.slice(0, atIdx);
    // afterAt could be ref or ref/subpath
    const slashIdx = afterAt.indexOf('/');
    if (slashIdx !== -1) {
      ref = afterAt.slice(0, slashIdx);
      const subpath = afterAt.slice(slashIdx + 1);
      const url = `https://github.com/${remaining}`;
      return { url: normalizeUrl(url), ref, subpath: subpath || undefined, raw };
    }
    ref = afterAt;
  }

  // Remaining is org/repo or org/repo/subpath
  const parts = remaining.split('/');
  if (parts.length < 2) {
    throw new Error(
      `Invalid source: "${raw}". Expected format: org/repo, a Git URL, or a Git subpath URL.`,
    );
  }

  const org = parts[0];
  const repo = parts[1];
  const subpath = parts.length > 2 ? parts.slice(2).join('/') : undefined;
  const url = `https://github.com/${org}/${repo}`;

  return { url: normalizeUrl(url), ref, subpath: subpath || undefined, raw };
}

/** Remove trailing .git and trailing slashes */
function normalizeUrl(url: string): string {
  return url.replace(/\.git$/, '').replace(/\/+$/, '');
}

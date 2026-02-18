/**
 * Skill discovery within a cloned/extracted directory.
 *
 * Recursively finds SKILL.md files, parses frontmatter, and returns skill metadata.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import { globSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  relativePath: string;
  frontmatter: Record<string, unknown>;
}

/**
 * Discover skills by finding SKILL.md files.
 * If subpath is provided, only search within that subdirectory.
 */
export async function discoverSkills(
  rootDir: string,
  subpath?: string,
): Promise<SkillInfo[]> {
  const searchDir = subpath ? join(rootDir, subpath) : rootDir;
  const skillFiles = findSkillFiles(searchDir);
  const skills: SkillInfo[] = [];

  for (const filePath of skillFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      const dir = dirname(filePath);
      const name = (frontmatter.name as string) || basename(dir);

      skills.push({
        name,
        description: (frontmatter.description as string) || '',
        path: dir,
        relativePath: relative(rootDir, dir),
        frontmatter,
      });
    } catch {
      // Skip unparseable skill files
    }
  }

  return skills;
}

function findSkillFiles(dir: string): string[] {
  const results: string[] = [];

  try {
    walk(dir, results);
  } catch {
    // Directory might not exist
  }

  return results;
}

function walk(dir: string, results: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;

    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, results);
      } else if (entry === 'SKILL.md') {
        results.push(fullPath);
      }
    } catch {
      // Skip inaccessible entries
    }
  }
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML key: value parser (no nested objects needed for SKILL.md)
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: string | boolean = line.slice(colonIdx + 1).trim();

    // Handle quoted values
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle booleans
    if (value === 'true') {
      frontmatter[key] = true;
    } else if (value === 'false') {
      frontmatter[key] = false;
    } else {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

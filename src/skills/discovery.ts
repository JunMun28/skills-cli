import { relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  discoverSkills as discoverSkillsV2,
  type DiscoverSkillsOptions,
} from '../skills.ts';

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  relativePath: string;
  frontmatter: Record<string, unknown>;
}

export async function discoverSkills(
  rootDir: string,
  subpath?: string,
  options: DiscoverSkillsOptions = {},
): Promise<SkillInfo[]> {
  if (subpath) {
    const root = resolve(rootDir);
    const target = resolve(rootDir, subpath);
    if (!(target === root || target.startsWith(`${root}${sep}`))) {
      throw new Error('Subpath escapes repository root');
    }
  }
  const skills = await discoverSkillsV2(rootDir, subpath, options);
  return skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    path: skill.path,
    relativePath: relative(rootDir, skill.path),
    frontmatter: {
      name: skill.name,
      description: skill.description,
      ...(skill.metadata && { metadata: skill.metadata }),
    },
  }));
}

export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return {};
  try {
    const parsed = parseYaml(match[1] ?? '');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

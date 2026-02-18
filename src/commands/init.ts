/**
 * `skills init [name]` command.
 *
 * Creates a local skill template with valid frontmatter.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateSkillName } from '../skills/validate.js';

export async function initCommand(name?: string): Promise<void> {
  const skillName = name || 'my-skill';

  const validation = validateSkillName(skillName);
  if (!validation.valid) {
    console.error(`Invalid skill name: ${validation.errors.join(', ')}`);
    process.exit(1);
  }

  const dir = join(process.cwd(), skillName);

  if (existsSync(dir)) {
    console.error(`Directory already exists: ${dir}`);
    process.exit(1);
  }

  await mkdir(dir, { recursive: true });

  const skillMd = `---
name: ${skillName}
description: Describe what this skill does and when to use it
---

# ${skillName}

Instructions for the AI agent go here.

## When to Use

Describe when and how the agent should use this skill.

## Guidelines

- Guideline 1
- Guideline 2
`;

  await writeFile(join(dir, 'SKILL.md'), skillMd, 'utf-8');

  console.log(`Created skill template: ${dir}/`);
  console.log(`  ${dir}/SKILL.md`);
  console.log(`\nEdit SKILL.md to define your skill, then use \`skills add\` to install it.`);
}

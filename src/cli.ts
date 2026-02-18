#!/usr/bin/env node

import { Command } from 'commander';
import { VERSION } from './version.js';
import { addCommand } from './commands/add.js';
import { listCommand } from './commands/list.js';
import { findCommand } from './commands/find.js';
import { removeCommand } from './commands/remove.js';
import { checkCommand } from './commands/check.js';
import { updateCommand } from './commands/update.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('skills')
  .description('Internal skills CLI for installing reusable AI agent skills')
  .version(VERSION, '-v, --version');

program
  .command('add <source>')
  .description('Install skill(s) from a Git URL or subpath')
  .option('-g, --global', 'Install to user-level (global) scope')
  .option('-a, --agent <agents>', 'Target specific agents (comma-separated)')
  .option('-s, --skill <skills>', 'Select specific skills by name (comma-separated)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--all', 'Install all skills to all agents without prompts')
  .action(addCommand);

program
  .command('list')
  .alias('ls')
  .description('List installed skills')
  .option('-g, --global', 'Show global installations')
  .option('-a, --agent <agents>', 'Filter by agent names (comma-separated)')
  .action(listCommand);

program
  .command('find [query]')
  .alias('search')
  .description('Search the internal skills catalog')
  .action(findCommand);

program
  .command('remove [skills...]')
  .alias('rm')
  .description('Remove installed skills')
  .option('-g, --global', 'Remove from global scope')
  .option('-a, --agent <agents>', 'Target specific agents (comma-separated)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--all', 'Remove all skills from all agents without prompts')
  .action(removeCommand);

program
  .command('check')
  .description('Validate install structure, policy, and source reachability')
  .option('-g, --global', 'Check global installations')
  .option('-a, --agent <agents>', 'Filter by agent names (comma-separated)')
  .action(checkCommand);

program
  .command('update')
  .alias('upgrade')
  .description('Update outdated skills to latest commit')
  .option('-g, --global', 'Update global installations')
  .option('-a, --agent <agents>', 'Target specific agents (comma-separated)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(updateCommand);

program
  .command('init [name]')
  .description('Create a new skill template')
  .action(initCommand);

program.parse(process.argv);

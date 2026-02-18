/**
 * Command-safe Git runner.
 *
 * Uses child_process.spawn with shell: false to prevent injection.
 * All arguments are passed as an array, never interpolated into a shell string.
 */

import { spawn } from 'node:child_process';

export interface RunGitOptions {
  cwd?: string;
  timeout?: number;
}

const DEFAULT_TIMEOUT = 60_000; // 60 seconds

export function runGit(
  args: string[],
  options: RunGitOptions = {},
): Promise<string> {
  const { cwd, timeout = DEFAULT_TIMEOUT } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new GitError(`Failed to spawn git: ${err.message}`, args));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new GitError(stderr.trim() || `git exited with code ${code}`, args));
      }
    });
  });
}

export class GitError extends Error {
  readonly args: string[];

  constructor(message: string, args: string[]) {
    super(message);
    this.name = 'GitError';
    this.args = args;
  }
}

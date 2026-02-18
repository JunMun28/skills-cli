import { describe, it, expect } from 'vitest';
import { runGit, GitError } from '../../src/git/run-git.js';

describe('runGit', () => {
  it('runs git --version successfully', async () => {
    const output = await runGit(['--version']);
    expect(output).toContain('git version');
  });

  it('captures stdout', async () => {
    const output = await runGit(['help', '-a']);
    expect(output.length).toBeGreaterThan(0);
  });

  it('throws GitError on invalid command', async () => {
    await expect(runGit(['not-a-command'])).rejects.toThrow(GitError);
  });

  it('GitError includes args', async () => {
    try {
      await runGit(['not-a-command']);
    } catch (err) {
      expect(err).toBeInstanceOf(GitError);
      expect((err as GitError).args).toEqual(['not-a-command']);
    }
  });

  it('respects cwd option', async () => {
    // /tmp is not a git repo, so rev-parse should fail
    await expect(
      runGit(['rev-parse', '--show-toplevel'], { cwd: '/tmp' }),
    ).rejects.toThrow(GitError);
  });
});

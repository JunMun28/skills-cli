import { describe, it, expect } from 'vitest';
import {
  validateSkillName,
  validatePath,
  hasBlockedFileType,
  validateSkillFiles,
} from '../../src/skills/validate.js';

describe('validateSkillName', () => {
  it('accepts valid names', () => {
    expect(validateSkillName('my-skill').valid).toBe(true);
    expect(validateSkillName('skill_v2').valid).toBe(true);
    expect(validateSkillName('frontend-design').valid).toBe(true);
  });

  it('rejects empty name', () => {
    expect(validateSkillName('').valid).toBe(false);
  });

  it('rejects names with uppercase', () => {
    expect(validateSkillName('MySkill').valid).toBe(false);
  });

  it('rejects names with spaces', () => {
    expect(validateSkillName('my skill').valid).toBe(false);
  });

  it('rejects names with special chars', () => {
    expect(validateSkillName('my@skill').valid).toBe(false);
    expect(validateSkillName('my/skill').valid).toBe(false);
  });

  it('rejects names starting with hyphen or underscore', () => {
    expect(validateSkillName('-skill').valid).toBe(false);
    expect(validateSkillName('_skill').valid).toBe(false);
  });

  it('rejects dot and dotdot', () => {
    expect(validateSkillName('.').valid).toBe(false);
    expect(validateSkillName('..').valid).toBe(false);
  });

  it('rejects names longer than 128 chars', () => {
    expect(validateSkillName('a'.repeat(129)).valid).toBe(false);
  });
});

describe('validatePath', () => {
  it('accepts normal paths', () => {
    expect(validatePath('skills/my-skill').valid).toBe(true);
    expect(validatePath('src/tools').valid).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(validatePath('../../../etc/passwd').valid).toBe(false);
    expect(validatePath('skills/../../../etc').valid).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(validatePath('/etc/passwd').valid).toBe(false);
  });
});

describe('hasBlockedFileType', () => {
  it('blocks dangerous extensions', () => {
    expect(hasBlockedFileType('malware.exe')).toBe(true);
    expect(hasBlockedFileType('lib.dll')).toBe(true);
    expect(hasBlockedFileType('lib.dylib')).toBe(true);
    expect(hasBlockedFileType('lib.so')).toBe(true);
    expect(hasBlockedFileType('run.bat')).toBe(true);
  });

  it('allows safe extensions', () => {
    expect(hasBlockedFileType('readme.md')).toBe(false);
    expect(hasBlockedFileType('skill.ts')).toBe(false);
    expect(hasBlockedFileType('config.json')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(hasBlockedFileType('MALWARE.EXE')).toBe(true);
  });
});

describe('validateSkillFiles', () => {
  it('passes clean files', () => {
    expect(validateSkillFiles(['SKILL.md', 'helper.ts']).valid).toBe(true);
  });

  it('fails on blocked files', () => {
    const result = validateSkillFiles(['SKILL.md', 'payload.exe']);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

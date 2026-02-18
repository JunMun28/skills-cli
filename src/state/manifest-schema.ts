/**
 * Manifest schema version and types.
 */

export const MANIFEST_SCHEMA_VERSION = 1;

export interface ManifestEntry {
  install_id: string;
  source_url: string;
  source_type: 'git';
  resolved_commit: string;
  ref: string | undefined;
  subpath: string | undefined;
  skill_name: string;
  skill_path: string;
  agent: string;
  scope: 'project' | 'user';
  managed_root: string;
  installed_at: string;
  created_at: string;
  updated_at: string;
}

export interface Manifest {
  schema_version: number;
  skills: Record<string, ManifestEntry>;
}

export function createEmptyManifest(): Manifest {
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    skills: {},
  };
}

/** Validate manifest structure. Returns errors or empty array. */
export function validateManifest(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return ['Manifest must be a JSON object'];
  }

  const obj = data as Record<string, unknown>;

  if (obj.schema_version !== MANIFEST_SCHEMA_VERSION) {
    errors.push(
      `Expected schema_version ${MANIFEST_SCHEMA_VERSION}, got ${obj.schema_version}`,
    );
  }

  if (!obj.skills || typeof obj.skills !== 'object') {
    errors.push('Manifest must have a "skills" object');
    return errors;
  }

  const skills = obj.skills as Record<string, unknown>;
  for (const [key, entry] of Object.entries(skills)) {
    if (!entry || typeof entry !== 'object') {
      errors.push(`skills["${key}"] must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    if (!e.install_id) errors.push(`skills["${key}"] missing install_id`);
    if (!e.managed_root) errors.push(`skills["${key}"] missing managed_root`);
    if (!e.source_url) errors.push(`skills["${key}"] missing source_url`);
    if (!e.resolved_commit) errors.push(`skills["${key}"] missing resolved_commit`);
    if (!e.skill_name) errors.push(`skills["${key}"] missing skill_name`);
    if (!e.agent) errors.push(`skills["${key}"] missing agent`);
    if (!e.scope) errors.push(`skills["${key}"] missing scope`);
  }

  return errors;
}

/** Stub for future schema migrations */
export function migrateManifest(data: unknown): Manifest {
  if (!data || typeof data !== 'object') {
    return createEmptyManifest();
  }

  const obj = data as Record<string, unknown>;

  // Currently only version 1 exists
  if (obj.schema_version === MANIFEST_SCHEMA_VERSION) {
    return data as Manifest;
  }

  // Unknown version - start fresh
  return createEmptyManifest();
}

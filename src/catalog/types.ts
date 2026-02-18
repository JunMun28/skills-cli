export interface CatalogEntry {
  name: string;
  description: string;
  tags: string[];
  source_url: string;
  default_ref: string;
  path: string;
  owner_team: string;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    isString(entry.name) &&
    isString(entry.description) &&
    Array.isArray(entry.tags) &&
    entry.tags.every(isString) &&
    isString(entry.source_url) &&
    isString(entry.default_ref) &&
    isString(entry.path) &&
    isString(entry.owner_team)
  );
}

export function parseCatalogJson(raw: string): CatalogEntry[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(isCatalogEntry);
  } catch {
    return null;
  }
}

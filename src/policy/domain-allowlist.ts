/**
 * Domain allowlist enforcement for Git sources.
 *
 * By default, allows common Git hosts. Can be overridden via
 * SKILLS_ALLOWED_DOMAINS environment variable (comma-separated)
 * or a config file at ~/.config/skills/allowed-domains.json.
 */

const DEFAULT_ALLOWED_DOMAINS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'skills.sh',
  'add-skill.vercel.sh',
];

let cachedAllowlist: string[] | null = null;

export function getAllowedDomains(): string[] {
  if (cachedAllowlist) return cachedAllowlist;

  const envDomains = process.env.SKILLS_ALLOWED_DOMAINS;
  if (envDomains) {
    cachedAllowlist = envDomains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    return cachedAllowlist;
  }

  cachedAllowlist = DEFAULT_ALLOWED_DOMAINS;
  return cachedAllowlist;
}

export function isDomainAllowed(url: string): boolean {
  const allowed = getAllowedDomains();
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return allowed.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function assertDomainAllowed(url: string): void {
  if (!isDomainAllowed(url)) {
    const allowed = getAllowedDomains();
    throw new Error(
      `Domain not in allowlist for URL: ${url}\nAllowed domains: ${allowed.join(', ')}\nSet SKILLS_ALLOWED_DOMAINS to override.`,
    );
  }
}

/** Reset cached allowlist (for testing) */
export function resetAllowlistCache(): void {
  cachedAllowlist = null;
}

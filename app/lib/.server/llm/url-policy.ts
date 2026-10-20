/**
 * Policy for provider endpoints that users provide.
 *
 * A user supplied base URL turns the server into a proxy, so the URL is
 * restricted to public https endpoints. Anything that could reach the
 * deployment's own network is rejected.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'];

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;

  if (a === 10 || a === 127 || a === 0) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

/**
 * Expands an IPv6 address into its eight groups.
 */
function expandIpv6(host: string): number[] | undefined {
  const value = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();

  if (!value.includes(':')) {
    return undefined;
  }

  const [head, tail, extra] = value.split('::');

  if (extra !== undefined) {
    return undefined;
  }

  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];

  if (headGroups.length + tailGroups.length > 8) {
    return undefined;
  }

  const missing = 8 - headGroups.length - tailGroups.length;

  const groups = [...headGroups, ...Array.from({ length: missing }, () => '0'), ...tailGroups];

  const numbers: number[] = [];

  for (const group of groups) {
    const parsed = Number.parseInt(group || '0', 16);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffff) {
      return undefined;
    }

    numbers.push(parsed);
  }

  return numbers;
}

function isPrivateIpv6(host: string): boolean {
  const groups = expandIpv6(host);

  if (!groups) {
    return false;
  }

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  /**
   * The unspecified address and the loopback address.
   */
  if (groups.slice(0, 7).every((group) => group === 0) && g7 <= 1) {
    return true;
  }

  /**
   * IPv4 mapped addresses, for example `::ffff:127.0.0.1`.
   */
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isPrivateIpv4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`);
  }

  /**
   * Unique local addresses, `fc00::/7`.
   */
  if ((g0 & 0xfe00) === 0xfc00) {
    return true;
  }

  /**
   * Link local addresses, `fe80::/10`.
   */
  if ((g0 & 0xffc0) === 0xfe80) {
    return true;
  }

  return false;
}

export interface UrlPolicyResult {
  ok: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Validates a user supplied provider endpoint.
 *
 * @param allowInsecure allows http, only used for local development.
 */
export function checkProviderUrl(rawUrl: string, allowInsecure = false): UrlPolicyResult {
  const value = rawUrl?.trim();

  if (!value) {
    return { ok: false, reason: 'The endpoint is empty.' };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'The endpoint is not a valid URL.' };
  }

  if (url.protocol !== 'https:') {
    if (!(allowInsecure && url.protocol === 'http:')) {
      return { ok: false, reason: 'The endpoint has to use https.' };
    }
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'The endpoint must not contain credentials.' };
  }

  const host = url.hostname.toLowerCase();

  /**
   * Local endpoints are only allowed when insecure endpoints are explicitly
   * enabled, which is the case for local development against a local model
   * server.
   */
  if (!allowInsecure) {
    if (BLOCKED_HOSTNAMES.has(host)) {
      return { ok: false, reason: 'The endpoint must not point at a local or internal host.' };
    }

    if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
      return { ok: false, reason: 'The endpoint must not point at a local or internal host.' };
    }

    if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
      return { ok: false, reason: 'The endpoint must not point at a private network address.' };
    }
  }

  return { ok: true, url };
}

/**
 * Removes the trailing slash so the endpoint can be joined with a path.
 */
export function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '');
}

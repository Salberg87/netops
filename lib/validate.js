/**
 * Input validation for anything that reaches a system command.
 *
 * netops is driven by people *and* by Claude, so hosts and counts must never
 * be able to smuggle shell syntax or extra flags into ping/traceroute/whois.
 */

// Hostnames, IPv4 and IPv6 literals. No spaces, no shell metacharacters,
// and no leading "-" (which a command would read as a flag).
const HOST_RE = /^(?!-)[A-Za-z0-9._:%-]{1,253}$/;

export function isValidHost(host) {
  return typeof host === 'string' && HOST_RE.test(host);
}

export function assertHost(host) {
  if (!isValidHost(host)) {
    throw new Error(`Invalid host: ${JSON.stringify(host)}`);
  }
  return host;
}

export function toBoundedInt(value, { min, max, fallback }) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

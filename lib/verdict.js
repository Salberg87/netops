/**
 * Turn diagnostic results into a short, plain-language verdict.
 *
 * Pure and dependency-free: used by the CLI card, the markdown report and the
 * Claude Code mod's pane, so all three say the same thing the same way.
 *
 * Voice rules (docs/brand/README.md): say what is true, in numbers people can
 * check; one sentence before details; suggest the next step; no hype, no
 * exclamation marks, no apologising for the network.
 */

const HINTS = {
  connectivity: 'Check Wi-Fi or the cable first, then restart the router.',
  dns: 'A faster resolver such as 1.1.1.1 or 8.8.8.8 usually fixes this.',
  ping: 'Packet loss is often Wi-Fi. Try `netops wifi`, or a cable.',
  latency: 'A cable, or sitting closer to the router, usually helps.',
  vpn: 'If things feel slow, try once with the VPN off to compare.',
};

const round = (v) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

/** Headline for an overall status. */
export function headline(status, connected = true) {
  if (!connected) return "You're offline";
  if (status === 'ok') return 'All good';
  if (status === 'warn') return 'Mostly fine';
  return "Something's off";
}

/**
 * @param {object} r  runDiagnostics() output, or the mod's Summary shape
 *                    (pingMs, dnsMs, vpn, issues, status, connected)
 * @returns {{ tone: 'ok'|'warn'|'fail', headline: string, sentence: string,
 *             notes: { text: string, hint?: string }[] }}
 */
export function verdict(r) {
  const connected = r.connected ?? r.connectivity?.connected ?? false;
  const status = r.status ?? 'fail';
  const issues = Array.isArray(r.issues) ? r.issues : [];

  if (!connected) {
    return {
      tone: 'fail',
      headline: headline(status, false),
      sentence: 'None of the test sites answered.',
      notes: [{ text: 'No internet connectivity', hint: HINTS.connectivity }],
    };
  }

  const ping = round(r.pingMs ?? (r.ping?.success ? r.ping.avgTime : undefined));
  const dns = round(r.dnsMs ?? r.dnsSpeed?.avgTime);
  const down = round(r.downMbps ?? (r.speed?.download?.success ? r.speed.download.speedMbps : undefined));
  const vpnName = r.vpn && typeof r.vpn === 'string'
    ? r.vpn
    : (r.vpn?.vpns || []).map(v => v.name || v.interface).filter(Boolean)[0];

  const parts = [];
  if (ping !== undefined) parts.push(`${ping} ms to the internet`);
  if (dns !== undefined) parts.push(`DNS answers in ${dns} ms`);
  if (down !== undefined) parts.push(`${down} Mbps down`);
  parts.push(vpnName ? `traffic goes through ${vpnName}` : 'no VPN in the way');

  const sentence = joinParts(parts) + '.';

  // One hint per area, on the first issue of that area.
  const seen = new Set();
  const notes = issues.map(i => {
    const hint = seen.has(i.area) ? undefined : HINTS[i.area];
    seen.add(i.area);
    return { text: i.message, hint };
  });

  return { tone: status, headline: headline(status, true), sentence, notes };
}

function joinParts(parts) {
  if (parts.length <= 1) return capitalise(parts[0] || 'Checked');
  return capitalise(parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]);
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

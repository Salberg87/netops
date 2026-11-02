import { runDiagnostics } from './diagnose.js';
import { verdict } from './verdict.js';

/**
 * Render diagnostic results (from runDiagnostics) as plain markdown.
 * No colors, no spinners — designed for piping to an LLM.
 */
export function renderReport(r) {
  const lines = [];
  const d = new Date(r.timestamp);
  const ts = d.toLocaleDateString('sv') + ' ' + d.toLocaleTimeString('sv', { hour: '2-digit', minute: '2-digit' });

  lines.push(`# Network Report — ${ts}`);
  lines.push('');
  const v = r.verdict || verdict(r);
  lines.push(`**${v.headline}.** ${v.sentence}`);
  for (const n of v.notes) lines.push(`- ${n.text}${n.hint ? ` — ${n.hint}` : ''}`);
  lines.push('');

  const conn = r.connectivity;
  lines.push('## Connectivity');
  lines.push(`- Status: ${conn.connected ? 'Connected' : 'Disconnected'} (${conn.results.filter(x => x.success).length}/${conn.results.length} endpoints)`);
  for (const x of conn.results) {
    let host = x.url;
    try { host = new URL(x.url).hostname; } catch { /* keep raw url */ }
    lines.push(`- ${host}: ${x.success ? x.responseTime + 'ms' : x.error}`);
  }
  lines.push('');

  if (r.vpn) {
    lines.push('## VPN/Proxy');
    lines.push(`- Default route: ${r.vpn.defaultInterface || 'unknown'} → ${r.vpn.defaultGateway || 'unknown'}`);
    if (r.vpn.vpns?.length > 0) {
      for (const v of r.vpn.vpns) {
        const name = v.name || v.interface || 'Unknown';
        const typeLabel = v.type === 'tunnel' ? 'tunnel' : v.type === 'proxy' ? 'system proxy' : 'process';
        lines.push(`- ${name}: ${typeLabel}${v.address ? ' (' + v.address + ')' : ''}`);
      }
    } else {
      lines.push('- No VPN/proxy detected');
    }
    lines.push('');
  }

  if (r.dns) {
    lines.push('## DNS');
    lines.push(`- Resolution of ${r.target}: ${r.dns.success ? 'OK' : 'FAILED'} (${r.dns.responseTime}ms)`);
    if (r.dnsSpeed) lines.push(`- Server speed: ${r.dnsSpeed.avgTime}ms avg`);
    lines.push('');
  }

  if (r.ping) {
    lines.push('## Ping');
    const p = r.ping;
    lines.push(p.success
      ? `- ${p.host}: ${p.avgTime}ms avg, ${p.packetLoss}% loss, min=${p.minTime}ms max=${p.maxTime}ms`
      : `- ${p.host}: FAILED — ${p.error}`);
    lines.push('');
  }

  if (r.latency) {
    lines.push('## Latency');
    const l = r.latency;
    if (l.success) {
      lines.push(`- Average: ${l.avgLatency}ms, Jitter: ${l.jitter}ms, Std Dev: ${l.stdDev}ms`);
      lines.push(`- Min: ${l.minLatency}ms, Max: ${l.maxLatency}ms`);
    } else {
      lines.push(`- FAILED: ${l.error}`);
    }
    lines.push('');
  }

  if (r.speed) {
    lines.push('## Speed');
    if (r.speed.download?.success) lines.push(`- Download: ${r.speed.download.speedMbps} Mbps`);
    if (r.speed.upload?.success) lines.push(`- Upload: ${r.speed.upload.speedMbps} Mbps`);
    lines.push('');
  }

  if (r.interfaces?.success) {
    lines.push('## Interfaces');
    for (const iface of r.interfaces.interfaces) {
      const ipv4 = iface.addresses.filter(a => a.family === 'IPv4' && !a.internal);
      if (ipv4.length > 0) {
        lines.push(`- ${iface.name} (${iface.type}): ${ipv4.map(a => a.address).join(', ')}`);
      }
    }
    const tunnelOnly = r.interfaces.interfaces.filter(i =>
      i.type === 'vpn/tunnel' && !i.addresses.some(a => a.family === 'IPv4' && !a.internal));
    if (tunnelOnly.length > 0) lines.push(`- ${tunnelOnly.length} other tunnel interfaces (IPv6 only)`);
    lines.push('');
  }

  lines.push('## Issues');
  if (r.issues.length === 0) lines.push('- None detected');
  for (const i of r.issues) lines.push(`- ${i.severity === 'fail' ? '✗' : '⚠'} [${i.area}] ${i.message}`);

  return lines.join('\n');
}

/** Run diagnostics and return the markdown report. */
export async function generateReport(opts) {
  return renderReport(await runDiagnostics(opts));
}

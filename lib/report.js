import { checkInternetConnectivity } from './http.js';
import { detectVPN, getInterfaces } from './interfaces.js';
import { dnsLookup, testDnsServer } from './dns.js';
import { ping } from './ping.js';
import { latencyTest } from './speedtest.js';

/**
 * Generate a plain markdown network report for LLM consumption.
 * No colors, no spinners — designed for piping.
 */
export async function generateReport() {
  const lines = [];
  const issues = [];
  const now = new Date();
  const ts = now.toLocaleDateString('sv') + ' ' + now.toLocaleTimeString('sv', { hour: '2-digit', minute: '2-digit' });

  lines.push(`# Network Report — ${ts}`);
  lines.push('');

  // Connectivity
  const conn = await checkInternetConnectivity();
  lines.push('## Connectivity');
  lines.push(`- Status: ${conn.connected ? 'Connected' : 'Disconnected'} (${conn.results.filter(r => r.success).length}/${conn.results.length} endpoints)`);
  for (const r of conn.results) {
    try {
      const host = new URL(r.url).hostname;
      lines.push(`- ${host}: ${r.success ? r.responseTime + 'ms' : r.error}`);
    } catch {
      lines.push(`- ${r.url}: ${r.success ? r.responseTime + 'ms' : r.error}`);
    }
  }
  if (!conn.connected) issues.push('No internet connectivity');
  lines.push('');

  // VPN
  const vpn = await detectVPN();
  lines.push('## VPN/Proxy');
  lines.push(`- Default route: ${vpn.defaultInterface || 'unknown'} → ${vpn.defaultGateway || 'unknown'}`);
  if (vpn.activeVpnRoute) {
    issues.push(`Traffic routed through VPN interface (${vpn.defaultInterface})`);
  }
  if (vpn.vpns?.length > 0) {
    for (const v of vpn.vpns) {
      const name = v.name || v.interface || 'Unknown';
      const typeLabel = v.type === 'tunnel' ? 'tunnel' :
                        v.type === 'proxy' ? 'system proxy' : 'process';
      lines.push(`- ${name}: ${typeLabel}${v.address ? ' (' + v.address + ')' : ''}`);
      issues.push(`${name} ${typeLabel} detected`);
    }
  } else {
    lines.push('- No VPN/proxy detected');
  }
  lines.push('');

  // DNS
  const dns = await dnsLookup('google.com', 'A');
  const dnsSpeed = await testDnsServer('google.com', 3);
  lines.push('## DNS');
  lines.push(`- Resolution: ${dns.success ? 'OK' : 'FAILED'} (${dns.responseTime}ms)`);
  lines.push(`- Server speed: ${dnsSpeed.avgTime}ms avg`);
  if (parseFloat(dnsSpeed.avgTime) > 50) issues.push(`Slow DNS server (${dnsSpeed.avgTime}ms avg)`);
  if (!dns.success) issues.push('DNS resolution failed');
  lines.push('');

  // Ping
  const pingResult = await ping('google.com', 4);
  lines.push('## Ping');
  if (pingResult.success) {
    lines.push(`- google.com: ${pingResult.avgTime}ms avg, ${pingResult.packetLoss}% loss, min=${pingResult.minTime}ms max=${pingResult.maxTime}ms`);
    if (pingResult.packetLoss > 0) issues.push(`Packet loss: ${pingResult.packetLoss}%`);
  } else {
    lines.push(`- google.com: FAILED — ${pingResult.error}`);
    issues.push('Ping to google.com failed');
  }
  lines.push('');

  // Latency
  const lat = await latencyTest(5);
  lines.push('## Latency');
  if (lat.success) {
    lines.push(`- Average: ${lat.avgLatency}ms, Jitter: ${lat.jitter}ms, Std Dev: ${lat.stdDev}ms`);
    lines.push(`- Min: ${lat.minLatency}ms, Max: ${lat.maxLatency}ms`);
    if (parseFloat(lat.avgLatency) > 100) issues.push(`High latency (${lat.avgLatency}ms avg)`);
    if (parseFloat(lat.jitter) > 30) issues.push(`High jitter (${lat.jitter}ms)`);
  } else {
    lines.push(`- FAILED: ${lat.error}`);
    issues.push('Latency test failed');
  }
  lines.push('');

  // Interfaces
  const ifaces = await getInterfaces();
  lines.push('## Interfaces');
  if (ifaces.success) {
    for (const iface of ifaces.interfaces) {
      const ipv4 = iface.addresses.filter(a => a.family === 'IPv4' && !a.internal);
      if (ipv4.length > 0) {
        lines.push(`- ${iface.name} (${iface.type}): ${ipv4.map(a => a.address).join(', ')}`);
      }
    }
    const tunnelOnly = ifaces.interfaces.filter(i =>
      i.type === 'vpn/tunnel' &&
      !i.addresses.some(a => a.family === 'IPv4' && !a.internal)
    );
    if (tunnelOnly.length > 0) {
      lines.push(`- ${tunnelOnly.length} other tunnel interfaces (IPv6 only)`);
    }
  }
  lines.push('');

  // Issues
  lines.push('## Issues');
  if (issues.length === 0) {
    lines.push('- None detected');
  } else {
    for (const issue of issues) {
      lines.push(`- ⚠ ${issue}`);
    }
  }

  return lines.join('\n');
}

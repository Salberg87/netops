import { colors, symbols } from './theme.js';
import {
  section, status, kv, kvColor, table, blank, indent, list,
  colorizeLatency, colorizeJitter, colorizeSpeed, formatBytes,
  outputResult, setJsonMode
} from './ui.js';

// Re-export for backward compat with index.js
export { outputResult, setJsonMode };

/**
 * Format ping results
 */
export function formatPingResults(results) {
  section('Ping');

  if (!results.success) {
    status('fail', `${results.host} — ${results.error}`);
    return;
  }

  status('ok', results.host);
  kv('Packets', `${results.packetsReceived}/${results.packetsTransmitted}`, `${results.packetLoss}% loss`);

  if (results.avgTime > 0) {
    const latStr = colorizeLatency(results.avgTime);
    indent(`${colors.label('Latency'.padEnd(9))}${latStr}${colors.muted('  min=' + results.minTime + '  max=' + results.maxTime)}`, 2);
  }

  const quality = results.packetLoss === 0 && results.avgTime < 50 ? 'Excellent' :
                  results.packetLoss < 5 && results.avgTime < 100 ? 'Good' :
                  results.packetLoss < 20 && results.avgTime < 300 ? 'Fair' : 'Poor';
  const qColor = quality === 'Excellent' || quality === 'Good' ? colors.success :
                 quality === 'Fair' ? colors.warning : colors.error;
  kvColor('Quality', quality, qColor);
}

/**
 * Format DNS results
 */
export function formatDnsResults(results) {
  section('DNS');

  if (!results.success) {
    status('fail', `${results.domain} (${results.recordType}) — ${results.error}`);
    return;
  }

  status('ok', `${results.domain}${colors.muted(' — ' + results.responseTime + 'ms')}`);
  blank();

  if (Array.isArray(results.records)) {
    for (const record of results.records) {
      if (results.recordType === 'MX' && typeof record === 'object') {
        indent(`${colors.label(results.recordType.padEnd(8))}${colors.value(record.exchange)} ${colors.muted('(pri ' + record.priority + ')')}`, 1);
      } else if (Array.isArray(record)) {
        // TXT records come as arrays
        indent(`${colors.label(results.recordType.padEnd(8))}${colors.muted(record.join(''))}`, 1);
      } else if (typeof record === 'object') {
        indent(`${colors.label(results.recordType.padEnd(8))}${colors.value(JSON.stringify(record))}`, 1);
      } else {
        indent(`${colors.label(results.recordType.padEnd(8))}${colors.value(record)}`, 1);
      }
    }
  }
}

/**
 * Format comprehensive DNS results
 */
export function formatComprehensiveDns(results) {
  section('DNS');

  const domain = Object.values(results).find(r => r.domain)?.domain || '';
  const responseTime = Object.values(results).find(r => r.success)?.responseTime || 0;
  status('ok', `${domain}${colors.muted(' — ' + responseTime + 'ms')}`);
  blank();

  for (const [type, result] of Object.entries(results)) {
    if (!result.success) {
      indent(`${colors.muted(type.padEnd(8) + '(none)')}`, 1);
      continue;
    }

    if (!result.records || result.records.length === 0) {
      indent(`${colors.muted(type.padEnd(8) + '(none)')}`, 1);
      continue;
    }

    const formatted = result.records.map(record => {
      if (type === 'MX' && typeof record === 'object') {
        return `${colors.value(record.exchange)} ${colors.muted('(pri ' + record.priority + ')')}`;
      }
      if (type === 'TXT' && Array.isArray(record)) {
        const txt = record.join('');
        return colors.muted(txt.length > 50 ? txt.substring(0, 47) + '…' : txt);
      }
      return colors.value(String(record));
    });

    // First record on same line as type
    indent(`${colors.label(type.padEnd(8))}${formatted[0]}`, 1);
    // Additional records indented
    for (let i = 1; i < formatted.length; i++) {
      indent(`${''.padEnd(8)}${formatted[i]}`, 1);
    }
  }
}

/**
 * Format HTTP test results
 */
export function formatHttpResults(results) {
  section('HTTP');

  if (!results.success) {
    status('fail', `${results.url} — ${results.error}`);
    return;
  }

  const statusColor = results.statusCode < 300 ? colors.success :
                      results.statusCode < 400 ? colors.warning : colors.error;

  status('ok', results.url);
  kvColor('Status', `${results.statusCode} ${results.statusMessage}`, statusColor);
  indent(`${colors.label('Time'.padEnd(9))}${colorizeLatency(results.responseTime)}`, 2);
  kv('Size', formatBytes(results.contentLength));
  kv('Protocol', results.protocol);
}

/**
 * Format speed test results
 */
export function formatSpeedTestResults(results) {
  section('Speed');

  if (results.latency?.success) {
    indent(`${colors.label('Latency'.padEnd(9))}${colorizeLatency(results.latency.avgLatency)}${colors.muted('  min=' + results.latency.minLatency + '  max=' + results.latency.maxLatency)}`, 2);
    indent(`${colors.label('Jitter'.padEnd(9))}${colorizeJitter(results.latency.jitter)}${colors.muted('  stddev=' + results.latency.stdDev + 'ms')}`, 2);
  }

  if (results.download?.success) {
    indent(`${colors.label('Download'.padEnd(9))}${colorizeSpeed(results.download.speedMbps)}${colors.muted('  (' + results.download.speedMBps + ' MB/s)')}`, 2);
  } else if (results.download) {
    kvColor('Download', 'FAILED — ' + results.download.error, colors.error);
  }

  if (results.upload?.success) {
    indent(`${colors.label('Upload'.padEnd(9))}${colorizeSpeed(results.upload.speedMbps, { good: 20, ok: 5 })}${colors.muted('  (' + results.upload.speedMBps + ' MB/s)')}`, 2);
  } else if (results.upload) {
    kvColor('Upload', 'FAILED — ' + results.upload.error, colors.error);
  }

  if (results.timestamp) {
    blank();
    indent(colors.muted(`Tested at: ${new Date(results.timestamp).toLocaleString()}`), 2);
  }
}

/**
 * Format connectivity check results
 */
export function formatConnectivityResults(results) {
  section('Connectivity');

  if (results.connected) {
    status('ok', `Internet is reachable`);
    indent(colors.muted(`Success rate: ${results.successRate}%`), 2);
  } else {
    status('fail', 'No internet connectivity detected');
  }

  blank();
  for (const result of results.results) {
    const host = new URL(result.url).hostname;
    if (result.success) {
      const latency = colorizeLatency(result.responseTime);
      indent(`${colors.label(host.padEnd(22))}${latency}`, 1);
    } else {
      indent(`${colors.label(host.padEnd(22))}${colors.error(result.error)}`, 1);
    }
  }
}

/**
 * Format traceroute results
 */
export function formatTracerouteResults(results) {
  section('Traceroute');

  if (!results.success) {
    status('fail', `${results.host} — ${results.error}`);
    return;
  }

  status('ok', `${results.host}${colors.muted(' — ' + results.totalHops + ' hops')}${results.partial ? colors.warning(' [partial]') : ''}`);
  blank();

  for (const hop of results.hops) {
    const hopNum = String(hop.hop).padStart(3);

    if (hop.timeout) {
      indent(colors.muted(`${hopNum}  * * *`), 1);
    } else {
      const host = hop.ip && hop.host !== hop.ip
        ? `${hop.host} (${hop.ip})`
        : hop.host || hop.ip || '???';
      const rtt = hop.rtt !== null ? colorizeLatency(hop.rtt) : colors.muted('--');
      indent(`${colors.muted(hopNum)}  ${colors.label(host.padEnd(40))} ${rtt}`, 1);
    }
  }
}

/**
 * Format port scan results
 */
export function formatPortResults(results) {
  section('Ports');

  if (!results.success) {
    status('fail', results.error);
    return;
  }

  indent(`${colors.label(results.host)}  ${colors.muted(results.totalPorts + ' scanned in ' + (results.totalTime / 1000).toFixed(1) + 's')}`, 1);
  indent(`${colors.success(results.open + ' open')} ${colors.muted('·')} ${colors.muted(results.closed + ' closed')} ${colors.muted('·')} ${colors.muted(results.filtered + ' filtered')}`, 1);

  const openPorts = results.results.filter(r => r.status === 'open');
  if (openPorts.length > 0) {
    table(
      ['PORT', 'SERVICE', 'TIME'],
      openPorts.map(p => [String(p.port), p.service, p.responseTime + 'ms']),
      () => colors.success
    );
  }

  const filteredPorts = results.results.filter(r => r.status === 'filtered');
  if (filteredPorts.length > 0 && filteredPorts.length <= 10) {
    blank();
    indent(colors.muted('Filtered:'), 1);
    for (const p of filteredPorts) {
      indent(colors.warning(`${String(p.port).padEnd(8)}${p.service}`), 1);
    }
  }
}

/**
 * Format interface results
 */
export function formatInterfaceResults(results) {
  section('Interfaces');

  if (!results.success) {
    status('fail', results.error);
    return;
  }

  indent(colors.muted(`Hostname: ${results.hostname}`), 1);
  blank();

  for (const iface of results.interfaces) {
    const ipv4 = iface.addresses.filter(a => a.family === 'IPv4' && !a.internal);
    const ipv6 = iface.addresses.filter(a => a.family === 'IPv6' && !a.internal);

    if (ipv4.length === 0 && ipv6.length === 0) continue;

    const typeLabel = iface.type !== 'other' ? colors.muted(` (${iface.type})`) : '';
    indent(`${colors.value(iface.name)}${typeLabel}`, 1);

    for (const addr of ipv4) {
      indent(`${colors.label('IPv4'.padEnd(6))}${colors.value(addr.address)} ${colors.muted('/ ' + addr.netmask)}`, 2);
    }
    for (const addr of ipv6) {
      indent(colors.muted(`IPv6  ${addr.address}`), 2);
    }
    if (iface.addresses[0]?.mac && iface.addresses[0].mac !== '00:00:00:00:00:00') {
      indent(colors.muted(`MAC   ${iface.addresses[0].mac}`), 2);
    }
    blank();
  }
}

/**
 * Format route table results
 */
export function formatRouteResults(results) {
  section('Routes');

  if (!results.success) {
    status('fail', results.error);
    return;
  }

  if (results.defaultGateway) {
    indent(`${colors.label('Default')}  ${colors.value(results.defaultGateway)} ${colors.muted('via ' + (results.defaultInterface || 'unknown'))}`, 1);
  }

  const keyRoutes = results.routes.filter(r =>
    !r.destination?.startsWith('ff') &&
    !r.destination?.startsWith('fe80') &&
    !r.destination?.includes('224') &&
    !r.destination?.includes('255.255.255.255')
  ).slice(0, 20);

  if (keyRoutes.length > 0) {
    table(
      ['DEST', 'GATEWAY', 'IFACE'],
      keyRoutes.map(r => [r.destination || '', r.gateway || '', r.interface || ''])
    );
  }
}

/**
 * Format VPN detection results
 */
export function formatVpnResults(results) {
  section('VPN / Proxy');

  if (!results.success) {
    status('fail', results.error);
    return;
  }

  if (results.activeVpnRoute) {
    status('warn', `Traffic via ${colors.value(results.defaultInterface)} ${colors.muted(symbols.arrow + ' ' + (results.defaultGateway || 'unknown'))}`);
  } else {
    status('ok', `Traffic via ${colors.value(results.defaultInterface || 'unknown')} ${colors.muted(symbols.arrow + ' ' + (results.defaultGateway || 'unknown'))}`);
  }

  if (results.vpns.length === 0) {
    status('ok', 'No VPN/proxy detected');
  } else {
    for (const vpn of results.vpns) {
      const name = vpn.name || vpn.interface || 'Unknown';
      const details = [];
      if (vpn.interface && vpn.address) details.push(vpn.address);
      if (vpn.type === 'proxy') {
        if (vpn.http) details.push('HTTP');
        if (vpn.https) details.push('HTTPS');
        if (vpn.socks) details.push('SOCKS');
      }
      const extra = details.length > 0 ? ` ${colors.muted('(' + details.join(', ') + ')')}` : '';
      const typeLabel = vpn.type === 'tunnel' ? 'tunnel' :
                        vpn.type === 'proxy' ? 'proxy' : 'process running';
      status('warn', `${name} ${colors.muted('(' + typeLabel + ')')}${extra}`);
    }
  }
}

/**
 * Format WiFi results
 */
export function formatWifiResults(results) {
  section('WiFi');

  if (!results.success) {
    status('fail', results.error || 'WiFi info unavailable');
    return;
  }

  status('ok', colors.value(results.ssid || 'unknown'));

  if (results.channel) kv('Channel', results.channel);
  if (results.security) kv('Security', results.security.replace('spairport_security_mode_', '').replace(/_/g, ' '));
  if (results.auth) kv('Auth', results.auth);

  if (results.rssi !== undefined) {
    const rssiColor = results.rssi >= -50 ? colors.success :
                      results.rssi >= -70 ? colors.warning : colors.error;
    kvColor('RSSI', results.rssi + ' dBm', rssiColor);
  }

  if (results.noise !== undefined) kv('Noise', results.noise + ' dBm');

  if (results.snr !== undefined) {
    const snrColor = results.snr >= 30 ? colors.success :
                     results.snr >= 20 ? colors.warning : colors.error;
    kvColor('SNR', results.snr + ' dB', snrColor);
  }

  if (results.txRate) kv('Tx Rate', results.txRate + ' Mbps');
  if (results.maxRate) kv('Max Rate', results.maxRate + ' Mbps');

  if (results.signalQuality) {
    const qColor = results.signalQuality === 'Excellent' || results.signalQuality === 'Good' ? colors.success :
                   results.signalQuality === 'Fair' ? colors.warning : colors.error;
    kvColor('Signal', results.signalQuality, qColor);
  }

  if (results.signalPercent !== undefined) {
    const pColor = results.signalPercent >= 70 ? colors.success :
                   results.signalPercent >= 40 ? colors.warning : colors.error;
    kvColor('Signal', results.signalPercent + '%', pColor);
  }
}

/**
 * Format WHOIS results
 */
export function formatWhoisResults(results) {
  section('WHOIS');

  if (!results.success) {
    status('fail', `${results.domain} — ${results.error}`);
    return;
  }

  status('ok', `${results.domainName || results.domain}${colors.muted(' — ' + results.responseTime + 'ms')}`);

  if (results.registrar) kv('Registrar', results.registrar);
  if (results.organization) kv('Org', results.organization);
  if (results.registrantName) kv('Holder', results.registrantName);
  if (results.country) kv('Country', results.country);
  if (results.createdDate) kv('Created', results.createdDate);

  if (results.expiryDate) {
    const expiryColor = results.daysUntilExpiry < 0 ? colors.error :
                        results.daysUntilExpiry < 30 ? colors.warning : colors.success;
    kvColor('Expires', results.expiryDate, colors.value, expiryColor(`[${results.daysUntilExpiry} days]`));
  }

  if (results.nameServers?.length > 0) {
    blank();
    indent(colors.label('Name Servers:'), 2);
    for (const ns of results.nameServers) {
      indent(colors.muted(symbols.bullet + ' ' + ns), 2);
    }
  }

  if (results.dnssec) kv('DNSSEC', results.dnssec);
}

/**
 * Format SSL certificate results
 */
export function formatCertResults(results) {
  section('Certificate');

  if (!results.success) {
    status('fail', `${results.host} — ${results.error}`);
    return;
  }

  if (results.authorized) {
    status('ok', `${results.host}${colors.muted(' — valid')}`);
  } else {
    status('fail', `${results.host} — ${colors.error(results.authError)}`);
  }

  kv('Subject', results.subject);
  kv('Issuer', results.issuer.replace(/CN=|O=|C=/g, '').replace(/, /g, ' / '));

  // Expiry with color
  const expiryColor = results.isExpired ? colors.error :
                      results.isExpiringSoon ? colors.warning : colors.success;
  const expiryLabel = results.isExpired ? 'EXPIRED' :
                      results.isExpiringSoon ? 'EXPIRING SOON' : 'OK';
  indent(`${colors.label('Expires'.padEnd(9))}${colors.value(results.validTo.split('T')[0])}  ${expiryColor('[' + expiryLabel + ' — ' + results.daysRemaining + ' days]')}`, 2);

  // TLS info
  if (results.protocol && results.cipher) {
    const bits = results.cipher.bits || extractBitsFromCipher(results.cipher.name);
    const bitsStr = bits ? ` (${bits} bit)` : '';
    kv('TLS', `${results.protocol.replace('TLSv', 'v')}`, `${results.cipher.name}${bitsStr}`);
  }

  // SANs
  if (results.sans?.length > 0) {
    const dnsNames = results.sans.filter(s => s.type === 'DNS').map(s => s.value);
    if (dnsNames.length > 0) {
      kv('SANs', dnsNames.slice(0, 5).join(', '), dnsNames.length > 5 ? `+${dnsNames.length - 5} more` : '');
    }
  }

  // Chain as inline
  if (results.chain?.length > 0) {
    const chainStr = results.chain
      .map(c => c.subject.replace(/CN=/, '').split(',')[0].trim())
      .join(` ${symbols.arrow} `);
    kv('Chain', '', chainStr);
  }

  indent(colors.muted(`Fingerprint: ${results.fingerprint}`), 2);
}

/**
 * Extract cipher bits from name (fallback for TLS 1.3)
 */
function extractBitsFromCipher(name) {
  const match = name?.match(/(\d{3})/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Format latency results (standalone)
 */
export function formatLatencyResults(results) {
  section('Latency');

  if (!results.success) {
    status('fail', results.error);
    return;
  }

  indent(`${colors.label('Average'.padEnd(9))}${colorizeLatency(results.avgLatency)}`, 2);
  kv('Min/Max', `${results.minLatency}ms / ${results.maxLatency}ms`);
  indent(`${colors.label('Jitter'.padEnd(9))}${colorizeJitter(results.jitter)}`, 2);
  kv('Std Dev', results.stdDev + 'ms');
  kv('Tests', `${results.count}`);
}

/**
 * Format DNS speed results (standalone)
 */
export function formatDnsSpeedResults(results) {
  section('DNS Speed');

  kv('Domain', results.domain);
  kv('Average', results.avgTime + 'ms');
  kv('Min/Max', `${results.minTime}ms / ${results.maxTime}ms`);
  kv('Tests', String(results.iterations));
}

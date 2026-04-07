import chalk from 'chalk';

let jsonMode = false;

/**
 * Enable/disable JSON output mode
 */
export function setJsonMode(enabled) {
  jsonMode = enabled;
}

/**
 * Output as JSON if json mode is enabled, otherwise run formatter
 */
export function outputResult(data, formatter) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    formatter(data);
  }
}

/**
 * Format ping results
 */
export function formatPingResults(results) {
  console.log(chalk.bold.cyan('\n=== PING RESULTS ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Failed to ping ${results.host}`));
    console.log(chalk.red(`  Error: ${results.error}`));
    return;
  }

  console.log(chalk.green(`✓ Host: ${results.host}`));
  console.log(`  Packets: ${results.packetsTransmitted} transmitted, ${results.packetsReceived} received, ${results.packetLoss}% loss`);

  if (results.avgTime > 0) {
    let timeColor = chalk.green;
    if (results.avgTime > 100) timeColor = chalk.yellow;
    if (results.avgTime > 300) timeColor = chalk.red;

    console.log(`  Time: min=${results.minTime}ms avg=${timeColor(results.avgTime + 'ms')} max=${results.maxTime}ms`);
  }

  // Quality assessment
  if (results.packetLoss === 0 && results.avgTime < 50) {
    console.log(chalk.green('  Quality: Excellent'));
  } else if (results.packetLoss < 5 && results.avgTime < 100) {
    console.log(chalk.yellow('  Quality: Good'));
  } else if (results.packetLoss < 20 && results.avgTime < 300) {
    console.log(chalk.yellow('  Quality: Fair'));
  } else {
    console.log(chalk.red('  Quality: Poor'));
  }
}

/**
 * Format DNS results
 */
export function formatDnsResults(results) {
  console.log(chalk.bold.cyan('\n=== DNS LOOKUP RESULTS ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Failed to lookup ${results.domain} (${results.recordType})`));
    console.log(chalk.red(`  Error: ${results.error}`));
    console.log(`  Response time: ${results.responseTime}ms`);
    return;
  }

  console.log(chalk.green(`✓ Domain: ${results.domain}`));
  console.log(`  Record type: ${results.recordType}`);
  console.log(`  Response time: ${results.responseTime}ms`);

  if (Array.isArray(results.records)) {
    console.log(chalk.bold('  Records:'));
    results.records.forEach(record => {
      if (typeof record === 'object') {
        console.log(`    ${JSON.stringify(record)}`);
      } else {
        console.log(`    ${record}`);
      }
    });
  }
}

/**
 * Format comprehensive DNS results
 */
export function formatComprehensiveDns(results) {
  console.log(chalk.bold.cyan('\n=== COMPREHENSIVE DNS CHECK ===\n'));

  Object.entries(results).forEach(([type, result]) => {
    if (result.success) {
      console.log(chalk.green(`✓ ${type} Records:`));
      if (result.records && result.records.length > 0) {
        result.records.forEach(record => {
          console.log(`  - ${typeof record === 'object' ? JSON.stringify(record) : record}`);
        });
      } else {
        console.log(chalk.gray('  (none found)'));
      }
    } else {
      console.log(chalk.gray(`○ ${type}: ${result.error}`));
    }
    console.log();
  });
}

/**
 * Format HTTP test results
 */
export function formatHttpResults(results) {
  console.log(chalk.bold.cyan('\n=== HTTP TEST RESULTS ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Failed to connect to ${results.url}`));
    console.log(chalk.red(`  Error: ${results.error}`));
    console.log(`  Response time: ${results.responseTime}ms`);
    return;
  }

  const statusColor = results.statusCode < 300 ? chalk.green :
                      results.statusCode < 400 ? chalk.yellow : chalk.red;

  console.log(chalk.green(`✓ URL: ${results.url}`));
  console.log(`  Status: ${statusColor(results.statusCode + ' ' + results.statusMessage)}`);
  console.log(`  Response time: ${colorizeLatency(results.responseTime)}`);
  console.log(`  Content length: ${formatBytes(results.contentLength)}`);
  console.log(`  Protocol: ${results.protocol}`);
}

/**
 * Format speed test results
 */
export function formatSpeedTestResults(results) {
  console.log(chalk.bold.cyan('\n=== SPEED TEST RESULTS ===\n'));

  if (results.latency) {
    console.log(chalk.bold('Latency:'));
    if (results.latency.success) {
      console.log(`  Average: ${colorizeLatency(results.latency.avgLatency)}`);
      console.log(`  Min: ${results.latency.minLatency}ms`);
      console.log(`  Max: ${results.latency.maxLatency}ms`);
      if (results.latency.jitter !== undefined) {
        console.log(`  Jitter: ${colorizeJitter(results.latency.jitter)}`);
      }
      if (results.latency.stdDev !== undefined) {
        console.log(`  Std Dev: ${results.latency.stdDev}ms`);
      }
    } else {
      console.log(chalk.red(`  Failed: ${results.latency.error}`));
    }
    console.log();
  }

  if (results.download) {
    console.log(chalk.bold('Download:'));
    if (results.download.success) {
      const speed = parseFloat(results.download.speedMbps);
      const speedColor = speed > 50 ? chalk.green :
                        speed > 10 ? chalk.yellow : chalk.red;
      console.log(`  Speed: ${speedColor(results.download.speedMbps + ' Mbps')} (${results.download.speedMBps} MB/s)`);
      console.log(`  Data transferred: ${formatBytes(results.download.totalBytes)}`);
      console.log(`  Duration: ${results.download.duration}s`);
    } else {
      console.log(chalk.red(`  Failed: ${results.download.error}`));
    }
    console.log();
  }

  if (results.upload) {
    console.log(chalk.bold('Upload:'));
    if (results.upload.success) {
      const speed = parseFloat(results.upload.speedMbps);
      const speedColor = speed > 20 ? chalk.green :
                        speed > 5 ? chalk.yellow : chalk.red;
      console.log(`  Speed: ${speedColor(results.upload.speedMbps + ' Mbps')} (${results.upload.speedMBps} MB/s)`);
      console.log(`  Data transferred: ${formatBytes(results.upload.totalBytes)}`);
      console.log(`  Duration: ${results.upload.duration}s`);
    } else {
      console.log(chalk.red(`  Failed: ${results.upload.error}`));
    }
    console.log();
  }

  if (results.timestamp) {
    console.log(chalk.gray(`Tested at: ${new Date(results.timestamp).toLocaleString()}`));
  }
}

/**
 * Format connectivity check results
 */
export function formatConnectivityResults(results) {
  console.log(chalk.bold.cyan('\n=== INTERNET CONNECTIVITY CHECK ===\n'));

  if (results.connected) {
    console.log(chalk.green(`✓ Internet is reachable`));
    console.log(`  Success rate: ${results.successRate}%\n`);
  } else {
    console.log(chalk.red(`✗ No internet connectivity detected\n`));
  }

  console.log(chalk.bold('Test results:'));
  results.results.forEach(result => {
    if (result.success) {
      console.log(chalk.green(`  ✓ ${result.url} - ${result.responseTime}ms`));
    } else {
      console.log(chalk.red(`  ✗ ${result.url} - ${result.error}`));
    }
  });
}

/**
 * Format traceroute results
 */
export function formatTracerouteResults(results) {
  console.log(chalk.bold.cyan('\n=== TRACEROUTE ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Traceroute to ${results.host} failed`));
    console.log(chalk.red(`  Error: ${results.error}`));
    return;
  }

  console.log(chalk.bold(`Traceroute to ${results.host} (${results.totalHops} hops)${results.partial ? chalk.yellow(' [partial]') : ''}:\n`));

  for (const hop of results.hops) {
    const hopNum = String(hop.hop).padStart(3);

    if (hop.timeout) {
      console.log(chalk.gray(`  ${hopNum}  * * *`));
    } else {
      const host = hop.ip && hop.host !== hop.ip
        ? `${hop.host} (${hop.ip})`
        : hop.host || hop.ip || '???';
      const rtt = hop.rtt !== null ? colorizeLatency(hop.rtt) : chalk.gray('--');
      console.log(`  ${hopNum}  ${host}  ${rtt}`);
    }
  }
}

/**
 * Format port scan results
 */
export function formatPortResults(results) {
  console.log(chalk.bold.cyan('\n=== PORT SCAN RESULTS ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Port scan failed: ${results.error}`));
    return;
  }

  console.log(chalk.bold(`Host: ${results.host}`));
  console.log(`Scanned: ${results.totalPorts} ports in ${results.totalTime}ms`);
  console.log(`Open: ${chalk.green(results.open)} | Closed: ${chalk.gray(results.closed)} | Filtered: ${chalk.yellow(results.filtered)}\n`);

  // Show open ports
  const openPorts = results.results.filter(r => r.status === 'open');
  if (openPorts.length > 0) {
    console.log(chalk.bold('Open ports:'));
    for (const port of openPorts) {
      console.log(chalk.green(`  ✓ ${String(port.port).padEnd(6)} ${port.service.padEnd(20)} ${port.responseTime}ms`));
    }
  }

  // Show filtered ports (if any)
  const filteredPorts = results.results.filter(r => r.status === 'filtered');
  if (filteredPorts.length > 0 && filteredPorts.length <= 10) {
    console.log(chalk.bold('\nFiltered ports:'));
    for (const port of filteredPorts) {
      console.log(chalk.yellow(`  ? ${String(port.port).padEnd(6)} ${port.service}`));
    }
  }
}

/**
 * Format interface results
 */
export function formatInterfaceResults(results) {
  console.log(chalk.bold.cyan('\n=== NETWORK INTERFACES ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Failed: ${results.error}`));
    return;
  }

  console.log(chalk.bold(`Hostname: ${results.hostname}\n`));

  for (const iface of results.interfaces) {
    const typeLabel = iface.type !== 'other' ? chalk.gray(` (${iface.type})`) : '';
    const ipv4 = iface.addresses.filter(a => a.family === 'IPv4' && !a.internal);
    const ipv6 = iface.addresses.filter(a => a.family === 'IPv6' && !a.internal);

    // Skip interfaces with no external addresses
    if (ipv4.length === 0 && ipv6.length === 0) continue;

    console.log(chalk.bold.green(`  ${iface.name}${typeLabel}`));
    for (const addr of ipv4) {
      console.log(`    IPv4: ${addr.address}  mask: ${addr.netmask}`);
    }
    for (const addr of ipv6) {
      console.log(chalk.gray(`    IPv6: ${addr.address}`));
    }
    if (iface.addresses[0]?.mac && iface.addresses[0].mac !== '00:00:00:00:00:00') {
      console.log(chalk.gray(`    MAC:  ${iface.addresses[0].mac}`));
    }
    console.log();
  }
}

/**
 * Format route table results
 */
export function formatRouteResults(results) {
  console.log(chalk.bold.cyan('\n=== ROUTING TABLE ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Failed: ${results.error}`));
    return;
  }

  if (results.defaultGateway) {
    console.log(chalk.bold(`Default Gateway: ${chalk.green(results.defaultGateway)}`));
    console.log(chalk.bold(`Default Interface: ${chalk.green(results.defaultInterface || 'unknown')}\n`));
  }

  // Show key routes (skip link-local and multicast)
  const keyRoutes = results.routes.filter(r =>
    !r.destination?.startsWith('ff') &&
    !r.destination?.startsWith('fe80') &&
    !r.destination?.includes('224') &&
    !r.destination?.includes('255.255.255.255')
  ).slice(0, 20);

  if (keyRoutes.length > 0) {
    console.log(chalk.bold('Key routes:'));
    console.log(chalk.gray('  ' + 'Destination'.padEnd(20) + 'Gateway'.padEnd(20) + 'Interface'));
    for (const route of keyRoutes) {
      const dest = (route.destination || '').padEnd(20);
      const gw = (route.gateway || '').padEnd(20);
      const iface = route.interface || '';
      const isDefault = route.destination === 'default' || route.destination === '0.0.0.0';
      const color = isDefault ? chalk.green : chalk.white;
      console.log(color(`  ${dest}${gw}${iface}`));
    }
  }
}

/**
 * Format VPN detection results
 */
export function formatVpnResults(results) {
  console.log(chalk.bold.cyan('\n=== VPN / PROXY STATUS ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Detection failed: ${results.error}`));
    return;
  }

  console.log(chalk.bold(`Default interface: ${results.defaultInterface || 'unknown'}`));
  console.log(chalk.bold(`Default gateway: ${results.defaultGateway || 'unknown'}`));

  if (results.activeVpnRoute) {
    console.log(chalk.yellow(`\n⚠ Traffic is routed through VPN interface (${results.defaultInterface})`));
  } else {
    console.log(chalk.green(`\n✓ Traffic is going through normal interface`));
  }

  if (results.vpns.length === 0) {
    console.log(chalk.green('\n✓ No VPN/proxy detected'));
  } else {
    console.log(chalk.bold(`\nDetected (${results.vpns.length}):`));
    for (const vpn of results.vpns) {
      const name = vpn.name || vpn.interface || 'Unknown';
      const type = vpn.type === 'tunnel' ? 'tunnel interface' :
                   vpn.type === 'proxy' ? 'system proxy' : 'process';
      const details = [];
      if (vpn.interface) details.push(`iface: ${vpn.interface}`);
      if (vpn.address) details.push(`addr: ${vpn.address}`);
      if (vpn.http) details.push('HTTP proxy');
      if (vpn.https) details.push('HTTPS proxy');
      if (vpn.socks) details.push('SOCKS proxy');

      console.log(chalk.yellow(`  ⚡ ${name} (${type})${details.length ? ' — ' + details.join(', ') : ''}`));
    }
  }
}

/**
 * Format WiFi results
 */
export function formatWifiResults(results) {
  console.log(chalk.bold.cyan('\n=== WIFI STATUS ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ ${results.error || 'WiFi info unavailable'}`));
    return;
  }

  console.log(chalk.bold(`  SSID: ${chalk.green(results.ssid || 'unknown')}`));

  if (results.bssid) console.log(`  BSSID: ${results.bssid}`);
  if (results.channel) console.log(`  Channel: ${results.channel}`);
  if (results.security) console.log(`  Security: ${results.security}`);
  if (results.auth) console.log(`  Auth: ${results.auth}`);

  if (results.rssi !== undefined) {
    const rssiColor = results.rssi >= -50 ? chalk.green :
                      results.rssi >= -70 ? chalk.yellow : chalk.red;
    console.log(`  RSSI: ${rssiColor(results.rssi + ' dBm')}`);
  }

  if (results.noise !== undefined) {
    console.log(`  Noise: ${results.noise} dBm`);
  }

  if (results.snr !== undefined) {
    const snrColor = results.snr >= 30 ? chalk.green :
                     results.snr >= 20 ? chalk.yellow : chalk.red;
    console.log(`  SNR: ${snrColor(results.snr + ' dB')}`);
  }

  if (results.txRate) console.log(`  Tx Rate: ${results.txRate} Mbps`);
  if (results.maxRate) console.log(`  Max Rate: ${results.maxRate} Mbps`);

  if (results.signalQuality) {
    const qColor = results.signalQuality === 'Excellent' ? chalk.green :
                   results.signalQuality === 'Good' ? chalk.green :
                   results.signalQuality === 'Fair' ? chalk.yellow : chalk.red;
    console.log(`  Signal: ${qColor(results.signalQuality)}`);
  }

  if (results.signalPercent !== undefined) {
    const pColor = results.signalPercent >= 70 ? chalk.green :
                   results.signalPercent >= 40 ? chalk.yellow : chalk.red;
    console.log(`  Signal: ${pColor(results.signalPercent + '%')}`);
  }
}

/**
 * Format WHOIS results
 */
export function formatWhoisResults(results) {
  console.log(chalk.bold.cyan('\n=== WHOIS LOOKUP ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ WHOIS lookup failed for ${results.domain}`));
    console.log(chalk.red(`  Error: ${results.error}`));
    return;
  }

  console.log(chalk.bold(`  Domain: ${chalk.green(results.domainName || results.domain)}`));
  if (results.registrar) console.log(`  Registrar: ${results.registrar}`);
  if (results.organization) console.log(`  Organization: ${results.organization}`);
  if (results.registrantName) console.log(`  Registrant: ${results.registrantName}`);
  if (results.country) console.log(`  Country: ${results.country}`);
  if (results.createdDate) console.log(`  Created: ${results.createdDate}`);

  if (results.expiryDate) {
    const expiryColor = results.daysUntilExpiry < 0 ? chalk.red :
                        results.daysUntilExpiry < 30 ? chalk.yellow : chalk.green;
    console.log(`  Expires: ${results.expiryDate} ${expiryColor(`(${results.daysUntilExpiry} days)`)}`);
  }

  if (results.nameServers?.length > 0) {
    console.log(chalk.bold('  Name Servers:'));
    results.nameServers.forEach(ns => console.log(`    - ${ns}`));
  }

  if (results.dnssec) console.log(`  DNSSEC: ${results.dnssec}`);
  console.log(chalk.gray(`  Response time: ${results.responseTime}ms`));
}

/**
 * Format SSL certificate results
 */
export function formatCertResults(results) {
  console.log(chalk.bold.cyan('\n=== SSL CERTIFICATE ===\n'));

  if (!results.success) {
    console.log(chalk.red(`✗ Certificate check failed for ${results.host}`));
    console.log(chalk.red(`  Error: ${results.error}`));
    return;
  }

  // Valid/invalid
  if (results.authorized) {
    console.log(chalk.green(`✓ Certificate is valid`));
  } else {
    console.log(chalk.red(`✗ Certificate is NOT valid: ${results.authError}`));
  }

  console.log(`  Subject: ${results.subject}`);
  console.log(`  Issuer: ${results.issuer}`);

  // Expiry with color
  const expiryColor = results.isExpired ? chalk.red :
                      results.isExpiringSoon ? chalk.yellow : chalk.green;
  const expiryLabel = results.isExpired ? 'EXPIRED' :
                      results.isExpiringSoon ? 'EXPIRING SOON' : 'OK';
  console.log(`  Valid from: ${results.validFrom}`);
  console.log(`  Valid to: ${results.validTo} ${expiryColor(`[${expiryLabel} — ${results.daysRemaining} days]`)}`);

  // TLS info
  if (results.protocol) console.log(`  Protocol: ${results.protocol}`);
  if (results.cipher) {
    console.log(`  Cipher: ${results.cipher.name} (${results.cipher.bits} bits)`);
  }

  // SANs
  if (results.sans?.length > 0) {
    const dnsNames = results.sans.filter(s => s.type === 'DNS').map(s => s.value);
    if (dnsNames.length > 0) {
      console.log(chalk.bold('  SANs:'));
      dnsNames.slice(0, 10).forEach(name => console.log(`    - ${name}`));
      if (dnsNames.length > 10) {
        console.log(chalk.gray(`    ... and ${dnsNames.length - 10} more`));
      }
    }
  }

  // Chain
  if (results.chain?.length > 0) {
    console.log(chalk.bold('  Certificate chain:'));
    results.chain.forEach((cert, i) => {
      const prefix = i === 0 ? '  └─' : '    └─';
      console.log(chalk.gray(`${prefix} ${cert.subject}`));
    });
  }

  console.log(chalk.gray(`  Fingerprint: ${results.fingerprint}`));
  console.log(chalk.gray(`  Response time: ${results.responseTime}ms`));
}

/**
 * Colorize latency value
 */
function colorizeLatency(ms) {
  const val = parseFloat(ms);
  if (val < 50) return chalk.green(val + 'ms');
  if (val < 100) return chalk.yellow(val + 'ms');
  return chalk.red(val + 'ms');
}

/**
 * Colorize jitter value
 */
function colorizeJitter(ms) {
  const val = parseFloat(ms);
  if (val < 10) return chalk.green(val + 'ms');
  if (val < 30) return chalk.yellow(val + 'ms');
  return chalk.red(val + 'ms');
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Print a summary banner
 */
export function printBanner() {
  console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════╗
║           NetOps v2.0                 ║
║   Network Diagnostics CLI Tool        ║
╚═══════════════════════════════════════╝
  `));
}

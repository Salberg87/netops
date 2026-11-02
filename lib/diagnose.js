import { checkInternetConnectivity } from './http.js';
import { detectVPN, getInterfaces } from './interfaces.js';
import { dnsLookup, testDnsServer } from './dns.js';
import { ping } from './ping.js';
import { latencyTest, comprehensiveSpeedTest } from './speedtest.js';
import { verdict } from './verdict.js';

/**
 * Thresholds used to flag issues. Exported so tests, the report and the
 * Claude Code mod all agree on what "slow" means.
 */
export const THRESHOLDS = {
  dnsSlowMs: 50,
  latencyHighMs: 100,
  jitterHighMs: 30,
};

/**
 * Derive a list of issues from raw diagnostic results.
 * Pure function: no network access, easy to unit test.
 *
 * Each issue is { severity: 'fail' | 'warn', area, message }.
 */
export function findIssues(r) {
  const issues = [];
  const add = (severity, area, message) => issues.push({ severity, area, message });

  if (r.connectivity && !r.connectivity.connected) {
    add('fail', 'connectivity', 'No internet connectivity');
  }

  if (r.vpn) {
    if (r.vpn.activeVpnRoute) {
      add('warn', 'vpn', `Traffic routed through VPN interface (${r.vpn.defaultInterface})`);
    }
    for (const v of r.vpn.vpns || []) {
      const name = v.name || v.interface || 'Unknown';
      const typeLabel = v.type === 'tunnel' ? 'tunnel' : v.type === 'proxy' ? 'system proxy' : 'process';
      add('warn', 'vpn', `${name} ${typeLabel} detected`);
    }
  }

  if (r.dns && !r.dns.success) add('fail', 'dns', 'DNS resolution failed');
  if (r.dnsSpeed && parseFloat(r.dnsSpeed.avgTime) > THRESHOLDS.dnsSlowMs) {
    add('warn', 'dns', `Slow DNS server (${r.dnsSpeed.avgTime} ms avg)`);
  }

  if (r.ping) {
    if (!r.ping.success) add('fail', 'ping', `Ping to ${r.ping.host || 'target'} failed`);
    else if (r.ping.packetLoss > 0) add('warn', 'ping', `Packet loss: ${r.ping.packetLoss}%`);
  }

  if (r.latency) {
    if (!r.latency.success) add('fail', 'latency', 'Latency test failed');
    else {
      if (parseFloat(r.latency.avgLatency) > THRESHOLDS.latencyHighMs) {
        add('warn', 'latency', `High latency (${r.latency.avgLatency} ms avg)`);
      }
      if (parseFloat(r.latency.jitter) > THRESHOLDS.jitterHighMs) {
        add('warn', 'latency', `High jitter (${r.latency.jitter} ms)`);
      }
    }
  }

  return issues;
}

/** Overall status from a list of issues. */
export function overallStatus(issues) {
  if (issues.some(i => i.severity === 'fail')) return 'fail';
  if (issues.length > 0) return 'warn';
  return 'ok';
}

/**
 * Run the standard diagnostic suite and return one structured object.
 * Used by `netops diagnose --json`, `netops report` and the Claude Code mod.
 *
 * @param {object} opts
 * @param {boolean} [opts.speed=false] also run the download/upload speed test
 * @param {string}  [opts.target='google.com'] host used for DNS/ping checks
 */
export async function runDiagnostics({ speed = false, target = 'google.com' } = {}) {
  const r = { timestamp: new Date().toISOString(), target };

  r.connectivity = await checkInternetConnectivity();

  if (r.connectivity.connected) {
    r.vpn = await detectVPN();
    r.dns = await dnsLookup(target, 'A');
    r.dnsSpeed = await testDnsServer(target, 3);
    r.ping = await ping(target, 4);
    r.latency = await latencyTest(5);
    if (speed) r.speed = await comprehensiveSpeedTest();
  } else {
    // Still useful offline: where is traffic supposed to go?
    r.vpn = await detectVPN().catch(() => undefined);
  }

  r.interfaces = await getInterfaces();
  r.issues = findIssues(r);
  r.status = overallStatus(r.issues);
  // Plain-language summary, so every reader (CLI, Claude, the pane) says the same thing.
  r.verdict = verdict(r);
  return r;
}

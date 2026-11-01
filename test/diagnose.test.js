import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findIssues, overallStatus } from '../lib/diagnose.js';
import { renderReport } from '../lib/report.js';

const healthy = {
  timestamp: '2026-01-01T12:00:00.000Z',
  target: 'example.com',
  connectivity: { connected: true, results: [{ success: true, url: 'https://example.com', responseTime: 20 }] },
  vpn: { vpns: [], activeVpnRoute: false, defaultInterface: 'en0', defaultGateway: '192.168.1.1' },
  dns: { success: true, responseTime: 5 },
  dnsSpeed: { avgTime: '12.0' },
  ping: { success: true, host: 'example.com', avgTime: 15, packetLoss: 0, minTime: 10, maxTime: 20 },
  latency: { success: true, avgLatency: '20', jitter: '3', stdDev: '2', minLatency: '18', maxLatency: '25' },
  interfaces: { success: true, interfaces: [] },
};

test('healthy network has no issues', () => {
  const issues = findIssues(healthy);
  assert.deepEqual(issues, []);
  assert.equal(overallStatus(issues), 'ok');
});

test('offline is a failure', () => {
  const issues = findIssues({ ...healthy, connectivity: { connected: false, results: [] } });
  assert.equal(overallStatus(issues), 'fail');
  assert.equal(issues[0].area, 'connectivity');
});

test('slow DNS, jitter and packet loss are warnings', () => {
  const issues = findIssues({
    ...healthy,
    dnsSpeed: { avgTime: '120' },
    ping: { ...healthy.ping, packetLoss: 25 },
    latency: { ...healthy.latency, jitter: '45' },
  });
  assert.deepEqual(issues.map(i => i.area).sort(), ['dns', 'latency', 'ping']);
  assert.equal(overallStatus(issues), 'warn');
});

test('VPN tunnel is reported', () => {
  const issues = findIssues({
    ...healthy,
    vpn: { ...healthy.vpn, activeVpnRoute: true, defaultInterface: 'utun3', vpns: [{ name: 'WireGuard', type: 'tunnel' }] },
  });
  assert.equal(issues.length, 2);
  assert.ok(issues.every(i => i.area === 'vpn'));
});

test('report renders issues section', () => {
  const r = { ...healthy, issues: [{ severity: 'warn', area: 'dns', message: 'Slow DNS' }], status: 'warn' };
  const md = renderReport(r);
  assert.match(md, /^# Network Report/);
  assert.match(md, /Overall: \*\*WARN\*\*/);
  assert.match(md, /\[dns\] Slow DNS/);
});

// Renders `netops diagnose` output from fixed sample data, through the real
// theme and formatters. Used to regenerate docs/preview.svg:
//
//   COLORTERM=truecolor FORCE_COLOR=3 node docs/demo/render.mjs > docs/demo/diagnose.ansi
//   python3 docs/demo/ansi2svg.py docs/demo/diagnose.ansi docs/preview.svg
import {
  formatConnectivityResults, formatVpnResults, formatDnsResults,
  formatPingResults, formatLatencyResults,
} from '../../lib/formatter.js';
import { banner, card } from '../../lib/ui.js';
import { colors } from '../../lib/theme.js';
import { findIssues, overallStatus } from '../../lib/diagnose.js';
import { verdict } from '../../lib/verdict.js';

const latencies = [18, 21, 17, 52, 19, 23, 61, 20, 18, 44, 19, 22];
const r = {
  connectivity: {
    connected: true, successRate: '100.0',
    results: [
      { success: true, url: 'https://www.google.com', responseTime: 21 },
      { success: true, url: 'https://www.cloudflare.com', responseTime: 17 },
      { success: true, url: 'https://www.amazon.com', responseTime: 64 },
    ],
  },
  vpn: { success: true, vpns: [], activeVpnRoute: false, defaultInterface: 'en0', defaultGateway: '192.168.1.1' },
  dns: { success: true, domain: 'google.com', recordType: 'A', responseTime: 9, records: ['142.250.74.46'] },
  dnsSpeed: { avgTime: '9.4' },
  ping: { success: true, host: 'google.com', packetsTransmitted: 4, packetsReceived: 4, packetLoss: 0, avgTime: 19.6, minTime: 17.1, maxTime: 23.0 },
  latency: { success: true, count: latencies.length, avgLatency: '27.8', minLatency: '17', maxLatency: '61', jitter: '18.4', stdDev: '14.9', latencies },
};

banner('quick check');
formatConnectivityResults(r.connectivity);
formatVpnResults(r.vpn);
formatDnsResults(r.dns);
formatPingResults(r.ping);
formatLatencyResults(r.latency);

// Same card the CLI prints, with one gentle warning to show the hints.
const issues = [...findIssues(r), { severity: 'warn', area: 'latency', message: 'Latency spikes up to 61 ms' }];
const v = verdict({ ...r, issues, status: overallStatus(issues) });
card({ tone: v.tone, headline: v.headline, body: [v.sentence, '', ...v.notes.map(n => ({ text: n.hint ? `${n.text}. ${n.hint}` : n.text }))] });
// Fixed footer so the picture does not change on every regeneration.
console.log('\n' + colors.muted('  done in 6.2s · 09:41') + '\n');

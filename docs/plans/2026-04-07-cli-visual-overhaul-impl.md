# CLI Visual Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor all CLI output to use a centralized design system with uniform styling, fix bugs, and add `report`/`ask` commands.

**Architecture:** New `lib/theme.js` (colors/symbols) + `lib/ui.js` (layout primitives). Refactor `lib/formatter.js` to use primitives. Add `lib/report.js` for LLM-friendly markdown output. Update `index.js` with new commands and CLI improvements.

**Tech Stack:** Node.js ES modules, chalk (hex colors), commander, ora

**Design doc:** `docs/plans/2026-04-07-cli-visual-overhaul.md`

---

### Task 1: Create theme.js

**Files:**
- Create: `lib/theme.js`

**Step 1: Create the theme module**

```js
import chalk from 'chalk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export const VERSION = pkg.version;

export const colors = {
  primary: chalk.hex('#5f9ea0'),
  success: chalk.hex('#6b9e6b'),
  warning: chalk.hex('#c8a54e'),
  error: chalk.hex('#b56b6b'),
  muted: chalk.gray,
  label: chalk.white,
  value: chalk.bold.white,
};

export const symbols = {
  ok: '✓',
  fail: '✗',
  warn: '⚠',
  bullet: '▸',
  sep: '─',
  arrow: '→',
};

export const SEPARATOR_WIDTH = 50;
```

**Step 2: Verify it loads**

Run: `node -e "import('./lib/theme.js').then(t => console.log(t.VERSION, Object.keys(t.colors)))"`
Expected: `2.0.0 ['primary','success','warning','error','muted','label','value']`

**Step 3: Commit**

```bash
git add lib/theme.js
git commit -m "feat: add theme module with color palette and symbols"
```

---

### Task 2: Create ui.js layout primitives

**Files:**
- Create: `lib/ui.js`

**Step 1: Create the UI primitives module**

```js
import { colors, symbols, SEPARATOR_WIDTH, VERSION } from './theme.js';

let _jsonMode = false;
let _suppressOutput = false;

export function setJsonMode(enabled) {
  _jsonMode = enabled;
}

export function setSuppressOutput(enabled) {
  _suppressOutput = enabled;
}

export function isJsonMode() {
  return _jsonMode;
}

function print(text = '') {
  if (_jsonMode || _suppressOutput) return;
  console.log(text);
}

export function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function outputResult(data, formatter) {
  if (_jsonMode) {
    outputJson(data);
  } else {
    formatter(data);
  }
}

export function banner() {
  const title = `netops v${VERSION}`;
  const padding = SEPARATOR_WIDTH - title.length - 6; // 6 = "─── " + " ─"
  const line = symbols.sep.repeat(3) + ' ' + title + ' ' + symbols.sep.repeat(Math.max(padding, 3));
  print(colors.primary(line));
}

export function section(title) {
  const padding = SEPARATOR_WIDTH - title.length - 6;
  const line = symbols.sep.repeat(3) + ' ' + title + ' ' + symbols.sep.repeat(Math.max(padding, 3));
  print('');
  print(colors.primary(line));
}

export function footer() {
  const now = new Date();
  const ts = now.toLocaleDateString('sv') + ' ' + now.toLocaleTimeString('sv', { hour: '2-digit', minute: '2-digit' });
  const title = `done ${symbols.bullet} ${ts}`;
  const padding = SEPARATOR_WIDTH - title.length - 6;
  const line = symbols.sep.repeat(3) + ' ' + title + ' ' + symbols.sep.repeat(Math.max(padding, 3));
  print('');
  print(colors.muted(line));
}

export function status(symbol, text) {
  const sym = symbol === 'ok' ? colors.success(symbols.ok) :
              symbol === 'fail' ? colors.error(symbols.fail) :
              symbol === 'warn' ? colors.warning(symbols.warn) :
              colors.muted(symbol);
  print(`  ${sym} ${colors.label(text)}`);
}

export function kv(key, val, extra) {
  const k = colors.label(key.padEnd(9));
  const v = colors.value(String(val));
  const e = extra ? '  ' + colors.muted(String(extra)) : '';
  print(`    ${k}${v}${e}`);
}

export function kvColor(key, val, color, extra) {
  const k = colors.label(key.padEnd(9));
  const v = color(String(val));
  const e = extra ? '  ' + colors.muted(String(extra)) : '';
  print(`    ${k}${v}${e}`);
}

export function table(headers, rows) {
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, String(row[i] || '').length), 0);
    return Math.max(h.length, maxRow) + 2;
  });

  print('');
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('');
  print('  ' + colors.muted(headerLine));

  for (const row of rows) {
    const line = row.map((cell, i) => String(cell || '').padEnd(widths[i])).join('');
    print('  ' + line);
  }
}

export function list(items) {
  for (const item of items) {
    print(`  ${colors.muted(symbols.bullet)} ${item}`);
  }
}

export function blank() {
  print('');
}

export function indent(text, level = 1) {
  print('  '.repeat(level) + text);
}

// Threshold-based colorizers
export function colorizeLatency(ms) {
  const val = parseFloat(ms);
  if (val < 50) return colors.success(val + 'ms');
  if (val < 100) return colors.warning(val + 'ms');
  return colors.error(val + 'ms');
}

export function colorizeJitter(ms) {
  const val = parseFloat(ms);
  if (val < 10) return colors.success(val + 'ms');
  if (val < 30) return colors.warning(val + 'ms');
  return colors.error(val + 'ms');
}

export function colorizeSpeed(mbps, thresholds = { good: 50, ok: 10 }) {
  const val = parseFloat(mbps);
  if (val > thresholds.good) return colors.success(mbps + ' Mbps');
  if (val > thresholds.ok) return colors.warning(mbps + ' Mbps');
  return colors.error(mbps + ' Mbps');
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

**Step 2: Verify it loads and renders**

Run: `node -e "import('./lib/ui.js').then(ui => { ui.banner(); ui.section('Test'); ui.status('ok', 'It works'); ui.kv('Speed', '240 Mbps', '30 MB/s'); ui.footer(); })"`
Expected: Colored output with teal separators, green checkmark, aligned key-value.

**Step 3: Commit**

```bash
git add lib/ui.js
git commit -m "feat: add UI primitives for consistent CLI output"
```

---

### Task 3: Refactor formatter.js to use UI primitives

**Files:**
- Modify: `lib/formatter.js` (complete rewrite — 580 → ~300 lines)

**Step 1: Rewrite formatter.js**

Replace the entire file. Each format function should use `section()`, `status()`, `kv()`, `table()` etc. from `ui.js`. Remove all direct `chalk` usage — get colors from `theme.js` only.

Key changes per formatter:
- `formatPingResults` → `section('Ping')` + `status()` + `kv()` for packets/latency/quality
- `formatDnsResults` → `section('DNS')` + `status()` + aligned type/value rows
- `formatComprehensiveDns` → same, but iterate types. Format MX as `host (pri N)` not raw JSON
- `formatHttpResults` → `section('HTTP')` + `status()` + `kv()`
- `formatSpeedTestResults` → `section('Speed')` + `kv()` with `colorizeSpeed()`
- `formatConnectivityResults` → `section('Connectivity')` + `status()` + endpoint list
- `formatTracerouteResults` → `section('Traceroute')` + aligned hop table
- `formatPortResults` → `section('Ports')` + summary + `table()` for open ports
- `formatInterfaceResults` → `section('Interfaces')` + grouped by interface
- `formatRouteResults` → `section('Routes')` + default gateway + `table()`
- `formatVpnResults` → `section('VPN / Proxy')` + `status()` per detection
- `formatWifiResults` → `section('WiFi')` + `kv()` with signal colorization
- `formatWhoisResults` → `section('WHOIS')` + `kv()` with expiry colorization
- `formatCertResults` → `section('Certificate')` + `kv()`. Fix cipher bits: use `cipher.bits || cipher.name.match()` fallback. Show chain as `A → B → C` inline.

Remove: `setJsonMode`, `outputResult`, `printBanner`, `formatBytes` — these now live in `ui.js`.

Export: all format functions only. Re-export `outputResult`, `setJsonMode` from `ui.js` for backward compat in `index.js`.

**Step 2: Verify each formatter renders correctly**

Run: `node -e "import('./lib/formatter.js').then(f => f.formatPingResults({ success: true, host: 'test.com', packetsTransmitted: 4, packetsReceived: 4, packetLoss: 0, minTime: 10, avgTime: 15, maxTime: 20 }))"`

Repeat for 2-3 other formatters to spot-check.

**Step 3: Commit**

```bash
git add lib/formatter.js
git commit -m "refactor: rewrite formatter.js to use UI primitives"
```

---

### Task 4: Update index.js — banner/footer, CLI improvements

**Files:**
- Modify: `index.js`

**Step 1: Update imports**

Replace formatter imports. Add `banner`, `footer`, `setJsonMode`, `outputResult` from `ui.js`.

**Step 2: Add global banner/footer hooks**

Use Commander's `preAction` and `postAction` hooks:
- `preAction`: set JSON mode if `--json`, call `banner()`
- `postAction`: call `footer()`
- For `diagnose`/`full`: suppress individual banner/footer, show once

**Step 3: Add CLI improvements**

- Add `--no-color` option (call `chalk.level = 0`)
- Enable `program.showSuggestionAfterError(true)` for fuzzy command matching
- Read version from package.json via `createRequire`

**Step 4: Verify**

Run: `node index.js check` — should show banner + section + footer
Run: `node index.js aks` — should suggest `ask`
Run: `node index.js --no-color check` — should show no colors
Run: `node index.js --json check` — should output JSON only, no banner/footer

**Step 5: Commit**

```bash
git add index.js
git commit -m "feat: add banner/footer to all commands, fuzzy match, --no-color"
```

---

### Task 5: Fix bugs

**Files:**
- Modify: `lib/cert.js` (cipher bits fix)
- Modify: `lib/whois.js` (Norid .no parsing)
- Modify: `lib/formatter.js` (MX format — should already be done in Task 3)

**Step 1: Fix cipher bits in cert.js**

In `checkCertificate()`, after getting cipher object, fix bits:
```js
cipher: cipher ? {
  name: cipher.name,
  version: cipher.version,
  bits: cipher.bits || extractBitsFromCipher(cipher.name)
} : null,
```

Add helper:
```js
function extractBitsFromCipher(name) {
  const match = name.match(/(\d{3})/);
  return match ? parseInt(match[1]) : null;
}
```

**Step 2: Fix WHOIS parser for .no domains**

In `whois.js`, add Norid-specific fields to `fieldMap`:
```js
'registrar': 'registrar',
'tech-c': 'techContact',
'holder': 'registrantName',
```

**Step 3: Verify fixes**

Run: `node index.js cert pifre.no` — cipher should show `128 bit` not `undefined`
Run: `node index.js whois pifre.no` — should show more fields

**Step 4: Commit**

```bash
git add lib/cert.js lib/whois.js
git commit -m "fix: cipher bits for TLS 1.3, WHOIS parsing for .no domains"
```

---

### Task 6: Add `netops report` command

**Files:**
- Create: `lib/report.js`
- Modify: `index.js`

**Step 1: Create report.js**

Generates a plain markdown report (no colors, no spinners). Runs connectivity, VPN, DNS, ping, latency, and interface checks. Includes an auto-detected "Issues" section.

```js
import { checkInternetConnectivity } from './http.js';
import { detectVPN, getInterfaces } from './interfaces.js';
import { dnsLookup, testDnsServer } from './dns.js';
import { ping } from './ping.js';
import { latencyTest } from './speedtest.js';

export async function generateReport() {
  const lines = [];
  const issues = [];
  const now = new Date();
  lines.push(`# Network Report — ${now.toLocaleDateString('sv')} ${now.toLocaleTimeString('sv', { hour: '2-digit', minute: '2-digit' })}`);
  lines.push('');

  // Connectivity
  const conn = await checkInternetConnectivity();
  lines.push('## Connectivity');
  lines.push(`- Status: ${conn.connected ? 'Connected' : 'Disconnected'} (${conn.results.filter(r => r.success).length}/${conn.results.length} endpoints)`);
  for (const r of conn.results) {
    lines.push(`- ${new URL(r.url).hostname}: ${r.success ? r.responseTime + 'ms' : r.error}`);
  }
  if (!conn.connected) issues.push('No internet connectivity');
  lines.push('');

  // VPN
  const vpn = await detectVPN();
  lines.push('## VPN/Proxy');
  lines.push(`- Default route: ${vpn.defaultInterface || 'unknown'} → ${vpn.defaultGateway || 'unknown'}`);
  if (vpn.vpns?.length > 0) {
    for (const v of vpn.vpns) {
      const name = v.name || v.interface || 'Unknown';
      lines.push(`- ${name}: ${v.type}${v.running ? ' (running)' : ''}`);
      issues.push(`${name} process running`);
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
  if (parseFloat(dnsSpeed.avgTime) > 50) issues.push(`Slow DNS (${dnsSpeed.avgTime}ms avg)`);
  lines.push('');

  // Ping
  const pingResult = await ping('google.com', 4);
  lines.push('## Ping');
  if (pingResult.success) {
    lines.push(`- google.com: ${pingResult.avgTime}ms avg, ${pingResult.packetLoss}% loss`);
    if (pingResult.packetLoss > 0) issues.push(`Packet loss: ${pingResult.packetLoss}%`);
  } else {
    lines.push(`- google.com: FAILED — ${pingResult.error}`);
    issues.push('Ping failed');
  }
  lines.push('');

  // Latency
  const lat = await latencyTest(5);
  lines.push('## Latency');
  if (lat.success) {
    lines.push(`- Average: ${lat.avgLatency}ms, Jitter: ${lat.jitter}ms, Std Dev: ${lat.stdDev}ms`);
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
    const tunnelOnly = ifaces.interfaces.filter(i => i.type === 'vpn/tunnel' && !i.addresses.some(a => a.family === 'IPv4' && !a.internal));
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
```

**Step 2: Add `report` command to index.js**

```js
import { generateReport } from './lib/report.js';

program
  .command('report')
  .description('Generate a markdown network report (for piping to LLMs)')
  .action(async () => {
    const report = await generateReport();
    console.log(report);
  });
```

Note: `report` should NOT show banner/footer (suppress output during report).

**Step 3: Verify**

Run: `node index.js report`
Expected: Clean markdown output, no colors, no spinners, with Issues section.

**Step 4: Commit**

```bash
git add lib/report.js index.js
git commit -m "feat: add netops report command for LLM-friendly output"
```

---

### Task 7: Add `netops ask` command

**Files:**
- Modify: `index.js`

**Step 1: Add ask command**

```js
import { execSync, spawn } from 'child_process';

program
  .command('ask [prompt]')
  .description('Run diagnostics and ask Claude to analyze the results')
  .action(async (prompt) => {
    // Check if claude is available
    try {
      execSync('which claude', { stdio: 'ignore' });
    } catch {
      console.error('Error: claude CLI not found. Install it from https://claude.ai/claude-code');
      process.exit(1);
    }

    // Generate report (suppress normal output)
    const { generateReport } = await import('./lib/report.js');
    const report = await generateReport();

    const defaultPrompt = 'Analyze this network diagnostic report. Flag any issues and suggest fixes. Be concise.';
    const userPrompt = prompt || defaultPrompt;

    // Pipe report to claude
    const claude = spawn('claude', ['-p', userPrompt], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    claude.stdin.write(report);
    claude.stdin.end();

    claude.on('close', (code) => {
      process.exit(code || 0);
    });
  });
```

**Step 2: Verify**

Run: `node index.js ask` — should run diagnostics then pipe to claude
Run: `node index.js ask "is my jitter ok?"` — should use custom prompt

**Step 3: Commit**

```bash
git add index.js
git commit -m "feat: add netops ask command — pipe diagnostics to Claude"
```

---

### Task 8: Update package.json and README

**Files:**
- Modify: `package.json` (bump version to 2.1.0)
- Modify: `README.md` (add report/ask docs, update example output section)
- Modify: `docs/preview.svg` (update to match new output style)

**Step 1: Bump version**

In `package.json`, change `"version": "2.0.0"` to `"version": "2.1.0"`.

**Step 2: Update README**

Add `report` and `ask` to the commands table. Add a section about piping to LLMs:

```markdown
## AI-powered diagnostics

```bash
# Generate a report and let Claude analyze it
netops ask

# Ask a specific question
netops ask "why is my jitter so high?"

# Pipe to any LLM
netops report | claude -p "analyze this"
netops report | llm "what's wrong?"
```

**Step 3: Update preview SVG to match new output style**

Regenerate the SVG with the new separator style and layout.

**Step 4: Commit and push**

```bash
git add package.json README.md docs/preview.svg
git commit -m "docs: update README for v2.1, add report/ask docs"
git push
```

---

### Task 9: Smoke test all commands

Run each command and verify output matches the design:

```bash
node index.js check
node index.js ping google.com
node index.js dns pifre.no -a
node index.js cert pifre.no
node index.js ports pifre.no
node index.js vpn
node index.js iface
node index.js route
node index.js wifi
node index.js whois pifre.no
node index.js latency -c 3
node index.js trace google.com
node index.js http https://pifre.no
node index.js report
node index.js --json check
node index.js --no-color check
node index.js aks  # should suggest 'ask'
```

Fix any inconsistencies found. Commit fixes.

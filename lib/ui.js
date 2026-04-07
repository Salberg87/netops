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
  const padding = SEPARATOR_WIDTH - title.length - 5;
  const line = symbols.sep.repeat(3) + ' ' + title + ' ' + symbols.sep.repeat(Math.max(padding, 3));
  print(colors.primary(line));
}

export function section(title) {
  const padding = SEPARATOR_WIDTH - title.length - 5;
  const line = symbols.sep.repeat(3) + ' ' + title + ' ' + symbols.sep.repeat(Math.max(padding, 3));
  print('');
  print(colors.primary(line));
}

export function footer() {
  const now = new Date();
  const ts = now.toLocaleDateString('sv') + ' ' + now.toLocaleTimeString('sv', { hour: '2-digit', minute: '2-digit' });
  const title = `done ${symbols.bullet} ${ts}`;
  const padding = SEPARATOR_WIDTH - title.length - 5;
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

export function table(headers, rows, colorFn) {
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, String(row[i] || '').length), 0);
    return Math.max(h.length, maxRow) + 2;
  });

  print('');
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('');
  print('  ' + colors.muted(headerLine));

  for (const row of rows) {
    const line = row.map((cell, i) => String(cell || '').padEnd(widths[i])).join('');
    const color = colorFn ? colorFn(row) : colors.label;
    print('  ' + color(line));
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

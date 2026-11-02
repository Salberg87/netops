import { colors, symbols, box, sparkBlocks, SEPARATOR_WIDTH, VERSION } from './theme.js';

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

const _startedAt = Date.now();
const PAD = '  ';

// Strip ANSI codes to measure what is actually drawn.
const visible = (str) => String(str).replace(/\x1b\[[0-9;]*m/g, '');

export function banner(subtitle) {
  print('');
  const tail = subtitle ? colors.muted('  ' + subtitle) : '';
  print(`${PAD}${colors.accent(symbols.mark + ' netops')} ${colors.muted(VERSION)}${tail}`);
}

export function section(title) {
  print('');
  print(`${PAD}${colors.accent(title)}`);
}

export function footer() {
  const secs = ((Date.now() - _startedAt) / 1000).toFixed(1);
  const now = new Date();
  const ts = now.toLocaleTimeString('sv', { hour: '2-digit', minute: '2-digit' });
  print('');
  print(colors.muted(`${PAD}done in ${secs}s ${symbols.bullet} ${ts}`));
  print('');
}

export function status(symbol, text) {
  const sym = symbol === 'ok' ? colors.success(symbols.ok) :
              symbol === 'fail' ? colors.error(symbols.fail) :
              symbol === 'warn' ? colors.warning(symbols.warn) :
              colors.muted(symbol);
  print(`${PAD}  ${sym} ${colors.value(text)}`);
}

export function kv(key, val, extra) {
  const k = colors.label(key.padEnd(9));
  const v = colors.value(String(val));
  const e = extra ? '  ' + colors.muted(String(extra)) : '';
  print(`${PAD}    ${k}${v}${e}`);
}

export function kvColor(key, val, color, extra) {
  const k = colors.label(key.padEnd(9));
  const v = color(String(val));
  const e = extra ? '  ' + colors.muted(String(extra)) : '';
  print(`${PAD}    ${k}${v}${e}`);
}

export function table(headers, rows, colorFn) {
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, String(row[i] || '').length), 0);
    return Math.max(h.length, maxRow) + 2;
  });

  print('');
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('');
  print(`${PAD}  ` + colors.muted(headerLine));

  for (const row of rows) {
    const line = row.map((cell, i) => String(cell || '').padEnd(widths[i])).join('');
    const color = colorFn ? colorFn(row) : colors.value;
    print(`${PAD}  ` + color(line));
  }
}

export function list(items) {
  for (const item of items) {
    print(`${PAD}  ${colors.muted(symbols.bullet)} ${item}`);
  }
}

export function blank() {
  print('');
}

export function indent(text, level = 1) {
  print(PAD + '  '.repeat(level) + text);
}

/**
 * A small sparkline from numbers, e.g. latency samples: ▂▃▂▅▂▃
 * Scaled to the samples' own range so the shape, not the size, shows.
 */
export function sparkline(values, width = 24) {
  const nums = (values || []).map(Number).filter(Number.isFinite).slice(-width);
  if (nums.length < 2) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  return nums.map(v => sparkBlocks[Math.round(((v - min) / span) * (sparkBlocks.length - 1))]).join('');
}

/** Word-wrap plain text to a width. */
function wrap(text, width) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (visible(line + ' ' + word).trim().length > width) {
      if (line) out.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * The verdict card: a rounded box with a headline and a plain-language line.
 *
 *   ╭────────────────────────────────────────────╮
 *   │  ✓ All good                                │
 *   │    18 ms to the internet, DNS in 9 ms.     │
 *   ╰────────────────────────────────────────────╯
 */
export function card({ tone = 'ok', headline, body = [], width = SEPARATOR_WIDTH }) {
  const tint = tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : colors.error;
  const sym = tone === 'ok' ? symbols.ok : tone === 'warn' ? symbols.warn : symbols.fail;
  const inner = width - 4;
  const row = (content) => {
    const pad = Math.max(0, inner - visible(content).length);
    return `${PAD}${colors.muted(box.v)} ${content}${' '.repeat(pad)} ${colors.muted(box.v)}`;
  };

  print('');
  print(PAD + colors.muted(box.tl + box.h.repeat(width - 2) + box.tr));
  print(row(`${tint(sym)} ${colors.strong(headline)}`));
  for (const para of body) {
    if (para === '') { print(row('')); continue; }
    const isNote = typeof para === 'object';
    const text = isNote ? para.text : para;
    const lines = wrap(text, inner - 2);
    lines.forEach((l, i) => {
      const lead = isNote && i === 0 ? colors.warning(symbols.warn) + ' ' : '  ';
      print(row(lead + (isNote ? l : colors.value(l))));
    });
  }
  print(PAD + colors.muted(box.bl + box.h.repeat(width - 2) + box.br));
}

// Threshold-based colorizers
export function colorizeLatency(ms) {
  const val = parseFloat(ms);
  if (val < 50) return colors.success(val + ' ms');
  if (val < 100) return colors.warning(val + ' ms');
  return colors.error(val + ' ms');
}

export function colorizeJitter(ms) {
  const val = parseFloat(ms);
  if (val < 10) return colors.success(val + ' ms');
  if (val < 30) return colors.warning(val + ' ms');
  return colors.error(val + ' ms');
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

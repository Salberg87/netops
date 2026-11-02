import chalk from 'chalk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export const VERSION = pkg.version;

/**
 * "Calm signal" palette — see docs/brand/README.md.
 *
 * Terminal colors are mid-tones chosen to read on both dark and light
 * backgrounds. Labels are dimmed and values use the terminal's own
 * foreground, so nothing disappears on a light theme.
 */
export const palette = {
  tide: '#3AA391',   // accent: the mark, section titles
  good: '#5DAA72',
  warn: '#D49A2E',
  bad: '#E06B58',
  mist: '#8A938F',   // secondary text
};

export const colors = {
  primary: chalk.hex(palette.tide),
  accent: chalk.hex(palette.tide).bold,
  success: chalk.hex(palette.good),
  warning: chalk.hex(palette.warn),
  error: chalk.hex(palette.bad),
  muted: chalk.hex(palette.mist),
  label: chalk.hex(palette.mist),
  value: chalk.reset,
  strong: chalk.bold,
};

export const symbols = {
  mark: '∿',
  ok: '✓',
  fail: '✗',
  warn: '!',
  bullet: '·',
  sep: '─',
  arrow: '→',
};

// Rounded box drawing for the verdict card.
export const box = { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };

// Eight-step blocks for sparklines.
export const sparkBlocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export const SEPARATOR_WIDTH = 52;

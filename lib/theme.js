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

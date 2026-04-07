# NetOps v2.1 — CLI Visual Overhaul

## Goal
Uniform, polished CLI output with a design system. Modern dev-tool feel (Vercel CLI style) with smooth teal/green palette.

## Design Decisions
- **Palette**: Dus, non-neon teal/green. `#5f9ea0` primary, `#6b9e6b` success, `#c8a54e` warning, `#b56b6b` error.
- **Separators**: Thin lines `─── Title ─────────────────` between sections.
- **Banner**: One-line header `─── netops v2.x ───────────` on all commands.
- **Footer**: `─── done · timestamp ──────` in muted on all commands.
- **Data**: Full dump always, but better formatted. No `--verbose` toggle.
- **Architecture**: Approach B — theme.js + ui.js design system, formatter.js refactored to use primitives.

## File Structure
```
lib/theme.js      — colors, symbols, constants
lib/ui.js         — layout primitives
lib/formatter.js  — refactored, uses ui.js
lib/report.js     — markdown report generator for LLM piping
```

## Theme (`lib/theme.js`)
```
colors:
  primary:  chalk.hex('#5f9ea0')  — headers, separators
  success:  chalk.hex('#6b9e6b')  — ✓, good values
  warning:  chalk.hex('#c8a54e')  — ⚠, medium values
  error:    chalk.hex('#b56b6b')  — ✗, bad values
  muted:    chalk.gray            — secondary info
  label:    chalk.white           — key labels
  value:    chalk.bold.white      — important values

symbols: ✓ ✗ ⚠ ▸ ─

SEPARATOR_WIDTH: 50
```

## UI Primitives (`lib/ui.js`)
- `banner()` — version header
- `section(title)` — section separator
- `footer()` — done + timestamp
- `status(symbol, text)` — status line with icon
- `kv(key, val, extra?)` — aligned key-value pair
- `table(headers, rows)` — column-aligned table with muted header
- `list(items)` — bullet list with ▸
- `blank()` — empty line
- `indent(text, level)` — indentation helper

All primitives respect `--json` mode (skip output) and `--no-color`.

## New Commands
- `netops report` — markdown report for piping (no color, no spinners)
- `netops ask [prompt?]` — runs report, pipes to `claude -p`

## Report Issues Detection
Flags automatically:
- Latency > 100ms
- Jitter > 30ms
- Packet loss > 0%
- VPN processes running
- SSL cert < 30 days
- DNS > 50ms

## Bug Fixes
- Cipher shows `(undefined bits)` → fallback for TLS 1.3
- WHOIS parser misses .no-specific fields → add Norid format
- MX shown as raw JSON → format as `host (pri N)`
- No command suggestions → enable `suggestAfterError(true)`
- Add explicit `--no-color` flag
- Read version from package.json instead of hardcoded

## Output Format (all commands)
```
─── netops v2.x ──────────────────────────────────
─── Section Title ────────────────────────────────
  ✓ Status line
    Key      Value (extra)
    Key      Value
─── done · 2026-04-07 11:59 ──────────────────────
```

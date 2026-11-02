# Changelog

## 2.2.0 — 2026-11-02

netops becomes a Claude Code plugin with a "calm signal" design.

### Added
- **Claude Code plugin**: the repository is now a plugin and a marketplace.
- **Skills**: `network-troubleshooting`, `dns-debugging`, `tls-and-http`,
  `port-and-route-checks`.
- **Mod**: `mcp__netops__diagnose` and `mcp__netops__run` tools, a `/netops`
  network health pane with refresh and speed-test buttons, and a status line.
- `diagnose --json`, `full --json` and `report --json` emit one structured
  object with `issues` and an overall `status`; `report --speed` and
  `report --target <host>`.
- `lib/diagnose.js` shared by the CLI report and the mod.
- Unit tests (`npm test`) and mod tests (`claude plugin test .`), CI workflow.
- LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- Brand: pulse-and-dot mark, light/dark logos, 1024 px plugin icon, palette and
  voice guide in `docs/brand/`.
- `lib/verdict.js`: plain-language verdict ("All good", "Mostly fine", ...)
  with one sentence and hints. It is shared by the CLI, the report, the JSON
  `verdict` field and the pane.
- CLI verdict card at the end of `diagnose` and `full`, a latency sparkline,
  a pulse spinner, and elapsed time in the footer.
- Redesigned `/netops` pane and status line (`∿ ✓ · 14 ms`).
- `docs/preview.svg` is now generated from real CLI output
  (`docs/demo/render.mjs` + `ansi2svg.py`); `docs/claude-pane.svg` shows the
  plugin in Claude Code.

### Changed
- Palette: one sea-glass accent with softer status colors. Labels are dimmed
  and values use the terminal foreground, so they read on light themes too
  (labels used to be hard white).
- Units are spaced (`18 ms`).

### Fixed
- **Security**: `ping`, `trace` and `whois` interpolated the host into a shell
  command. They now use `execFile` with validated arguments.
- Spinners no longer write to the terminal in `--json` mode.
- `speed` and `full` printed progress with `console.log`, which broke
  `--json` output.

## 2.1.0
- Design system, `report` and `ask` commands, bug fixes.

## 2.0.0
- Initial public CLI.

# Changelog

## 2.2.0

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

### Fixed
- **Security**: `ping`, `trace` and `whois` interpolated the host into a shell
  command. They now use `execFile` with validated arguments.
- Spinners no longer write to the terminal in `--json` mode.

## 2.1.0
- Design system, `report` and `ask` commands, bug fixes.

## 2.0.0
- Initial public CLI.

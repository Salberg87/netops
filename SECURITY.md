# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/Salberg87/netops/security/advisories/new)
instead. You should get a first response within a week.

Especially interesting:

- Any way to make netops run an arbitrary command or pass extra flags to
  `ping`, `traceroute`, `whois` or other system tools (all user/model input is
  supposed to be validated in `lib/validate.js` and `hooks/register.tsx`, and
  commands are run with `execFile`, never through a shell).
- Any way for the Claude Code tools (`mcp__netops__*`) to send data off the
  machine beyond what the documented checks do.

## Responsible use

netops includes a port scanner. Only scan hosts you own or are explicitly
authorised to test. The bundled Claude skills instruct Claude to ask before
scanning anything that is not clearly the user's own.

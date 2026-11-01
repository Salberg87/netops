# Contributing to netops

Thanks for helping! netops has three parts that live in one repository:

| Part | Where | What it is |
| --- | --- | --- |
| CLI | `index.js`, `lib/` | The Node.js diagnostics engine (`netops ...`) |
| Skills | `skills/*/SKILL.md` | Instructions that teach Claude *how to troubleshoot* with netops |
| Mod | `hooks/register.tsx`, `types/` | Claude Code hooks module: `mcp__netops__*` tools, `/netops` pane, status line |

The repository root is also the Claude Code plugin (`.claude-plugin/plugin.json`)
and its marketplace (`.claude-plugin/marketplace.json`).

## Setup

```bash
git clone https://github.com/Salberg87/netops && cd netops
npm install
node index.js diagnose
```

Run Claude Code against your working copy, with hot reload:

```bash
claude --plugin-dir .
```

## Before you open a PR

```bash
npm test                      # CLI unit tests (node:test)
claude plugin validate .      # manifest, skills, hooks module
claude plugin test .          # mod tests in tests/*.test.tsx
```

## Guidelines

- **Every command that touches the shell must use `execFile` with an argument
  array** and validate input with `lib/validate.js`. Never interpolate a host,
  URL or count into a shell string. The mod validates again before calling the
  CLI.
- **Keep `--json` output stable.** Skills and the mod depend on field names.
  If you rename a field, update `skills/`, `hooks/register.tsx` and the tests.
  Spinners and banners must never reach stdout in `--json` mode.
- **Issue thresholds live in `lib/diagnose.js` (`THRESHOLDS`).** Change them
  there and in `skills/network-troubleshooting/SKILL.md` together.
- **Skills**: one concern per skill, a `description` that says *when* to use it
  in the user's own words, and a short playbook rather than a manual.
- **Mod**: values a drawing reads go in `$.state` and are declared in
  `types/index.d.ts`; bump the `shape` tag when a stored value changes form.
- Cross-platform: macOS, Linux and Windows. If a check can't work on one, return
  `{ success: false, error }` rather than throwing.
- Conventional commit messages (`feat:`, `fix:`, `docs:` ...) are appreciated.

## Adding a CLI command

1. Implement it in `lib/<name>.js`, returning a plain object with `success`.
2. Add a formatter in `lib/formatter.js` and the command in `index.js`.
3. Add it to `COMMANDS` / `toArgv` in `hooks/register.tsx` if Claude should be
   able to call it, with validation for every argument.
4. Mention it in the relevant skill and in the README.
5. Add tests.

By contributing you agree that your contributions are licensed under the MIT
License, and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

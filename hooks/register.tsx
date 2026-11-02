import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RunState, Summary } from '../types'
import { verdict } from '../lib/verdict.js'

/**
 * netops mod for Claude Code.
 *
 * - Tools the model can call: `mcp__netops__diagnose` and `mcp__netops__run`
 * - `/netops` opens a health pane (refresh button, issues, key numbers)
 * - A status line entry with the latest result
 *
 * Every tool call shells out to the bundled CLI (`scripts/netops --json ...`)
 * by argument vector, never through a shell, and targets are validated first.
 */

const PANE = 'netops-health'

// "Calm signal" accent (docs/brand). Status colors use the host theme's keys.
const TIDE = '#3AA391'
const SPARK = '▁▂▃▄▅▆▇█'
const last = atom({ plugin: 'netops', key: 'last' } as const, null, { shape: 'summary-2' })
const run = atom({ plugin: 'netops', key: 'run' } as const, { isRunning: false }, { shape: 'run-1' })

// Same rule as lib/validate.js: hostnames and IP literals, no leading "-".
const HOST_RE = /^(?!-)[A-Za-z0-9._:%-]{1,253}$/
const URL_RE = /^https?:\/\/[^\s]{1,2048}$/
const PORTS_RE = /^[0-9]{1,5}(-[0-9]{1,5})?(,[0-9]{1,5}(-[0-9]{1,5})?)*$/

type Args = Record<string, unknown>

const COMMANDS = [
  'check', 'ping', 'dns', 'rdns', 'dns-speed', 'latency', 'trace', 'cert',
  'http', 'whois', 'iface', 'route', 'vpn', 'wifi', 'ports', 'speed',
] as const
type Command = (typeof COMMANDS)[number]

const NEEDS_TARGET = new Set<Command>(['ping', 'dns', 'rdns', 'trace', 'cert', 'http', 'whois', 'ports'])

const TIMEOUTS: Partial<Record<Command, number>> = {
  speed: 120_000, trace: 120_000, ports: 180_000, latency: 90_000,
}

const int = (v: unknown, min: number, max: number): string | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseInt(v, 10) : NaN
  return Number.isFinite(n) ? String(Math.min(max, Math.max(min, Math.trunc(n)))) : undefined
}

/** Turn a tool input into the CLI's argv, or a reason it is refused. */
export function toArgv(a: Args): string[] | { error: string } {
  const command = a.command as Command
  if (!COMMANDS.includes(command)) return { error: `Unknown command: ${String(a.command)}` }
  const target = typeof a.target === 'string' ? a.target.trim() : undefined

  if (NEEDS_TARGET.has(command)) {
    if (!target) return { error: `"${command}" needs a target` }
    const ok = command === 'http' ? URL_RE.test(target) : HOST_RE.test(target)
    if (!ok) return { error: `Invalid target for ${command}: ${JSON.stringify(target)}` }
  }

  const argv: string[] = [command]
  if (target && NEEDS_TARGET.has(command)) argv.push(target)

  switch (command) {
    case 'ping': { const c = int(a.count, 1, 50); if (c) argv.push('-c', c); break }
    case 'latency': { const c = int(a.count, 1, 50); if (c) argv.push('-c', c); break }
    case 'trace': { const m = int(a.maxHops, 1, 64); if (m) argv.push('-m', m); break }
    case 'cert': { const p = int(a.port, 1, 65535); if (p) argv.push('-p', p); break }
    case 'dns': {
      const t = typeof a.recordType === 'string' ? a.recordType.toUpperCase() : 'A'
      if (t === 'ALL') argv.push('-a')
      else if (['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'].includes(t)) argv.push('-t', t)
      else return { error: `Unsupported record type: ${t}` }
      break
    }
    case 'dns-speed': {
      if (target) {
        if (!HOST_RE.test(target)) return { error: `Invalid domain: ${JSON.stringify(target)}` }
        argv.push('-d', target)
      }
      break
    }
    case 'http': {
      const m = typeof a.method === 'string' ? a.method.toUpperCase() : 'GET'
      if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) return { error: 'Only GET, HEAD and OPTIONS are allowed' }
      argv.push('-m', m)
      break
    }
    case 'ports': {
      if (a.ports !== undefined) {
        const p = String(a.ports)
        if (!PORTS_RE.test(p)) return { error: `Invalid ports: ${p}` }
        argv.push('-p', p)
      }
      break
    }
    case 'speed': {
      if (a.mode === 'download') argv.push('-d')
      if (a.mode === 'upload') argv.push('-u')
      break
    }
  }
  return argv
}

/** Reduce `report --json` output to what the pane and status line show. */
export function summarize(r: any): Summary {
  const vpns: any[] = r?.vpn?.vpns ?? []
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined
  }
  return {
    at: r?.timestamp ?? new Date().toISOString(),
    status: r?.status ?? 'fail',
    connected: !!r?.connectivity?.connected,
    pingMs: r?.ping?.success ? num(r.ping.avgTime) : undefined,
    jitterMs: r?.latency?.success ? num(r.latency.jitter) : undefined,
    dnsMs: r?.dnsSpeed ? num(r.dnsSpeed.avgTime) : undefined,
    downMbps: r?.speed?.download?.success ? num(r.speed.download.speedMbps) : undefined,
    upMbps: r?.speed?.upload?.success ? num(r.speed.upload.speedMbps) : undefined,
    vpn: vpns.length ? vpns.map(v => v.name || v.interface).filter(Boolean).join(', ') : undefined,
    samples: Array.isArray(r?.latency?.latencies) ? r.latency.latencies.slice(-24).map(Number) : undefined,
    issues: Array.isArray(r?.issues) ? r.issues : [],
  }
}

/** ▂▃▂▅▂▃ from samples, scaled to their own range. */
export function sparkline(values: readonly number[] | undefined): string {
  const nums = (values ?? []).filter(Number.isFinite)
  if (nums.length < 2) return ''
  const min = Math.min(...nums)
  const span = Math.max(...nums) - min || 1
  return nums.map(v => SPARK[Math.round(((v - min) / span) * (SPARK.length - 1))]).join('')
}

const statusText = (s: Summary): string => {
  if (!s.connected) return '∿ offline'
  const mark = s.status === 'ok' ? '✓' : s.status === 'warn' ? '!' : '✗'
  const parts = [`∿ ${mark}`]
  if (s.pingMs !== undefined) parts.push(`${Math.round(s.pingMs)} ms`)
  if (s.issues.length) parts.push(`${s.issues.length} to look at`)
  return parts.join(' · ')
}

async function cli($: EngineInterface, argv: string[], timeoutMs = 60_000) {
  return $.process.run(['sh', `${$.plugin.root}/scripts/netops`, '--json', '--no-color', ...argv], { timeoutMs })
}

/** Run the diagnostic suite, store the summary, update the status line. */
async function diagnose($: EngineInterface, speed: boolean): Promise<{ json?: unknown; error?: string }> {
  const state: RunState = await read($, run)
  if (state.isRunning) return { error: 'A netops diagnostics run is already in progress.' }
  await update($, run, () => ({ isRunning: true }))
  $.ui.status('∿ checking…')
  try {
    const res = await cli($, ['report', ...(speed ? ['--speed'] : [])], speed ? 180_000 : 90_000)
    const json = JSON.parse(res.stdout)
    const s = summarize(json)
    await update($, last, () => s)
    await update($, run, () => ({ isRunning: false }))
    $.ui.status(statusText(s))
    return { json }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await update($, run, () => ({ isRunning: false, error }))
    $.ui.status('∿ check failed')
    return { error }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'netops',
      description: 'Open the netops network health pane and run a quick check',
    })

    await $.tool.register({
      name: 'diagnose',
      description:
        'Run the netops diagnostic suite on this machine: connectivity, VPN/proxy, DNS resolution and speed, ' +
        'ping, latency/jitter and interfaces. Returns structured JSON with an `issues` list and overall `status`. ' +
        'Use first when the user says the internet/network is slow, flaky or down. ' +
        'Set speed=true only when throughput matters (adds 20-30s and uses bandwidth).',
      inputSchema: {
        type: 'object',
        properties: { speed: { type: 'boolean', description: 'Also run download/upload speed test' } },
      },
      isDeferred: false,
    })

    await $.tool.register({
      name: 'run',
      description:
        'Run a single netops command and get JSON back. Commands: check, ping, dns, rdns, dns-speed, latency, ' +
        'trace, cert, http, whois, iface, route, vpn, wifi, ports, speed. ' +
        'Only scan ports on hosts the user owns or is authorised to test.',
      inputSchema: {
        type: 'object',
        required: ['command'],
        properties: {
          command: { type: 'string', enum: [...COMMANDS] },
          target: { type: 'string', description: 'Host, IP, domain, or URL (http). Required for ping, dns, rdns, trace, cert, http, whois, ports.' },
          count: { type: 'integer', description: 'ping/latency: number of probes' },
          recordType: { type: 'string', enum: ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'ALL'], description: 'dns: record type' },
          port: { type: 'integer', description: 'cert: TLS port (default 443)' },
          ports: { type: 'string', description: 'ports: e.g. "80,443" or "1-1024" (default: 21 common services)' },
          maxHops: { type: 'integer', description: 'trace: max hops' },
          method: { type: 'string', enum: ['GET', 'HEAD', 'OPTIONS'], description: 'http: method' },
          mode: { type: 'string', enum: ['both', 'download', 'upload'], description: 'speed: which direction' },
        },
      },
      isDeferred: false,
    })

    return next(e)
  })

  on('tool.call', { tool: 'mcp__netops__diagnose' }, async ($, e) => {
    const { json, error } = await diagnose($, (e as any).speed === true)
    if (error) return { deny: `netops diagnose failed: ${error}` }
    return { result: JSON.stringify(json, null, 2) }
  }).catch(() => ({ deny: 'netops: the diagnose tool failed unexpectedly.' }))

  on('tool.call', { tool: 'mcp__netops__run' }, async ($, e) => {
    const argv = toArgv(e as unknown as Args)
    if (!Array.isArray(argv)) return { deny: `netops: ${argv.error}` }
    try {
      const res = await cli($, argv, TIMEOUTS[argv[0] as Command])
      const out = res.stdout.trim() || res.stderr.trim() || `(exit ${res.exitCode}, no output)`
      return { result: out }
    } catch (err) {
      return { deny: `netops ${argv[0]} failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }).catch(() => ({ deny: 'netops: the run tool failed unexpectedly.' }))

  on('command.run', { command: 'netops' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Network health' })
    void diagnose($, false)
    return { text: 'netops: running a quick network check…' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s: Summary | null = await read($, last)
    const r: RunState = await read($, run)

    const toneColor = (t: Summary['status']) => (t === 'ok' ? 'success' : t === 'warn' ? 'warning' : 'error')
    const mark = (t: Summary['status']) => (t === 'ok' ? '✓' : t === 'warn' ? '!' : '✗')
    const metric = (label: string, value: string, extra?: string) => (
      <Text>
        <Text dimColor>{label.padEnd(8)}</Text>
        {value.padStart(9)}
        {extra && <Text color={TIDE}>{'   ' + extra}</Text>}
      </Text>
    )

    const actions = (
      <Box flexDirection="row" gap={2}>
        <Button key="check" variant="primary" onPress={() => void diagnose($, false)}>
          {r.isRunning ? 'Checking…' : s ? 'Check again' : 'Check now'}
        </Button>
        <Button key="speed" onPress={() => void diagnose($, true)}>
          Test speed
        </Button>
      </Box>
    )

    // Nothing measured yet: one friendly line and the button.
    if (!s) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text>
            <Text color={TIDE} bold>∿ </Text>
            <Text bold>{r.isRunning ? 'Checking your network…' : 'How is the network doing?'}</Text>
          </Text>
          <Text dimColor>
            {r.isRunning
              ? 'Connectivity, DNS, ping and latency. About ten seconds.'
              : 'A quick check takes about ten seconds and stays on this machine.'}
          </Text>
          {r.error && <Text color="error">The last check failed: {r.error}</Text>}
          {actions}
        </Box>
      )
    }

    const v = verdict(s)
    const time = new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color={toneColor(v.tone)}>
            {mark(v.tone)} {v.headline}
          </Text>
          <Text>{v.sentence}</Text>
          <Text dimColor>{r.isRunning ? 'Checking again…' : `Checked at ${time}`}</Text>
        </Box>

        {s.connected && (
          <Box flexDirection="column">
            {s.pingMs !== undefined && metric('Ping', `${Math.round(s.pingMs)} ms`, sparkline(s.samples))}
            {s.jitterMs !== undefined && metric('Jitter', `${Math.round(s.jitterMs)} ms`)}
            {s.dnsMs !== undefined && metric('DNS', `${Math.round(s.dnsMs)} ms`)}
            {s.downMbps !== undefined && metric('Down', `${Math.round(s.downMbps)} Mbps`)}
            {s.upMbps !== undefined && metric('Up', `${Math.round(s.upMbps)} Mbps`)}
            {s.vpn && metric('VPN', s.vpn)}
          </Box>
        )}

        {v.notes.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Worth a look</Text>
            {v.notes.map(n => (
              <Box flexDirection="column">
                <Text color="warning">! <Text color="text">{n.text}</Text></Text>
                {n.hint && <Text dimColor>{'  ' + n.hint}</Text>}
              </Box>
            ))}
          </Box>
        )}

        {r.error && <Text color="error">The last check failed: {r.error}</Text>}
        {actions}
      </Box>
    )
  })
}

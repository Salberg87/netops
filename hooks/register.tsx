import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RunState, Summary } from '../types'

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
const last = atom({ plugin: 'netops', key: 'last' } as const, null, { shape: 'summary-1' })
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
    issues: Array.isArray(r?.issues) ? r.issues : [],
  }
}

const statusText = (s: Summary): string => {
  const mark = s.status === 'ok' ? '✓' : s.status === 'warn' ? '!' : '✗'
  if (!s.connected) return `net ${mark} offline`
  const parts = [`net ${mark}`]
  if (s.pingMs !== undefined) parts.push(`${s.pingMs}ms`)
  if (s.issues.length) parts.push(`${s.issues.length} issue${s.issues.length > 1 ? 's' : ''}`)
  return parts.join(' ')
}

async function cli($: EngineInterface, argv: string[], timeoutMs = 60_000) {
  return $.process.run(['sh', `${$.plugin.root}/scripts/netops`, '--json', '--no-color', ...argv], { timeoutMs })
}

/** Run the diagnostic suite, store the summary, update the status line. */
async function diagnose($: EngineInterface, speed: boolean): Promise<{ json?: unknown; error?: string }> {
  const state: RunState = await read($, run)
  if (state.isRunning) return { error: 'A netops diagnostics run is already in progress.' }
  await update($, run, () => ({ isRunning: true }))
  $.ui.status('net … checking')
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
    $.ui.status('net ? error')
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

    const color = (st: Summary['status']) => (st === 'ok' ? 'success' : st === 'warn' ? 'warning' : 'error')
    const row = (label: string, value: string) => (
      <Text>
        <Text dimColor>{label.padEnd(9)}</Text>
        {value}
      </Text>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={2}>
          <Button key="refresh" variant="primary" onPress={() => void diagnose($, false)}>
            {r.isRunning ? 'Checking…' : 'Refresh'}
          </Button>
          <Button key="speed" onPress={() => void diagnose($, true)}>
            With speed test
          </Button>
        </Box>

        {r.error && <Text color="error">Last run failed: {r.error}</Text>}
        {!s && !r.isRunning && <Text dimColor>No results yet. Press Refresh.</Text>}

        {s && (
          <Box flexDirection="column">
            <Text bold color={color(s.status)}>
              {s.status === 'ok' ? '✓ Healthy' : s.status === 'warn' ? '! Degraded' : '✗ Problem'}
              <Text dimColor>  {new Date(s.at).toLocaleTimeString()}</Text>
            </Text>
            {row('Internet', s.connected ? 'connected' : 'offline')}
            {s.pingMs !== undefined && row('Ping', `${s.pingMs} ms`)}
            {s.jitterMs !== undefined && row('Jitter', `${s.jitterMs} ms`)}
            {s.dnsMs !== undefined && row('DNS', `${s.dnsMs} ms`)}
            {s.downMbps !== undefined && row('Down', `${s.downMbps} Mbps`)}
            {s.upMbps !== undefined && row('Up', `${s.upMbps} Mbps`)}
            {s.vpn && row('VPN', s.vpn)}
          </Box>
        )}

        {s && s.issues.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Issues</Text>
            {s.issues.map(i => (
              <Text color={i.severity === 'fail' ? 'error' : 'warning'}>
                {i.severity === 'fail' ? '✗' : '!'} {i.message}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}

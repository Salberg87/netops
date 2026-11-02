import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'netops',
  component: 'Pane',
  requestId: 'netops-health',
  props: {
    title: 'Network health',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const REPORT = {
  timestamp: '2026-01-01T12:00:00.000Z',
  status: 'warn',
  connectivity: { connected: true, results: [] },
  vpn: { vpns: [{ name: 'WireGuard', type: 'tunnel' }] },
  ping: { success: true, avgTime: 14.2 },
  latency: { success: true, jitter: '41.0' },
  dnsSpeed: { avgTime: '9.5' },
  issues: [{ severity: 'warn', area: 'latency', message: 'High jitter (41.0 ms)' }],
}

function engine(on: any, argvSeen: string[][]) {
  on('command.register', () => ({ value: { command: 'netops' } }))
  on('tool.register', (_: unknown, e: any) => ({ value: { tool: `mcp__netops__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('process.run', (_: unknown, e: any) => {
    argvSeen.push([...e.argv])
    const isReport = e.argv.includes('report')
    return {
      value: {
        exitCode: 0,
        stdout: isReport ? JSON.stringify(REPORT) : '{"success":true}',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
}

test('diagnose tool fills the pane on every surface', async ($, on) => {
  const seen: string[][] = []
  engine(on, seen)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const res: any = await $.tool.call({ tool: 'mcp__netops__diagnose' } as any)
  expect(res.deny).toBe(undefined)
  expect(seen[0]?.includes('report')).toBe(true)
  expect(seen[0]?.includes('--json')).toBe(true)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Mostly fine/ })) !== undefined).toBe(true)
    expect((await ui.find({ type: 'Text', text: /High jitter/ })) !== undefined).toBe(true)
    await ui.unmount()
  }
})

test('run tool refuses an injected target without spawning anything', async ($, on) => {
  const seen: string[][] = []
  engine(on, seen)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const res: any = await $.tool.call({ tool: 'mcp__netops__run', command: 'ping', target: 'x;rm -rf ~' } as any)
  expect(typeof res.deny).toBe('string')
  expect(seen.length).toBe(0)

  const flag: any = await $.tool.call({ tool: 'mcp__netops__run', command: 'whois', target: '-h evil' } as any)
  expect(typeof flag.deny).toBe('string')
  expect(seen.length).toBe(0)
})

test('run tool builds argv for dns', async ($, on) => {
  const seen: string[][] = []
  engine(on, seen)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await $.tool.call({ tool: 'mcp__netops__run', command: 'dns', target: 'example.com', recordType: 'mx' } as any)
  expect(seen[0]?.slice(-4)).toEqual(['dns', 'example.com', '-t', 'MX'])
})

test('empty pane invites a refresh', async ($, on) => {
  engine(on, [])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /How is the network doing/ })) !== undefined).toBe(true)
  await ui.unmount()
})

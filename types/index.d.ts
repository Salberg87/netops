/** Compact summary of the last diagnostics run, kept for the pane and status line. */
export type Summary = {
  at: string
  status: 'ok' | 'warn' | 'fail'
  connected: boolean
  pingMs?: number
  jitterMs?: number
  dnsMs?: number
  downMbps?: number
  upMbps?: number
  vpn?: string
  issues: { severity: 'fail' | 'warn'; area: string; message: string }[]
}

export type RunState = { isRunning: boolean; error?: string }

declare module 'claude-code' {
  interface PluginState {
    netops: {
      last: Shaped<Summary | null>
      run: Shaped<RunState>
    }
  }
}

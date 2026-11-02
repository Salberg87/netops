export type Tone = 'ok' | 'warn' | 'fail'
export type Note = { text: string; hint?: string }
export type Verdict = { tone: Tone; headline: string; sentence: string; notes: Note[] }
export function headline(status: Tone, connected?: boolean): string
export function verdict(r: Record<string, unknown>): Verdict

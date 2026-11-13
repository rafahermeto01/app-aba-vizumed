import type { LocalTrial } from '@/offline/db'

export type TargetStats = {
  total: number
  correct: number
  prompted: number
  errors: number
  /** % de acerto independente (+ ÷ total) */
  pctIndependent: number | null
  /** % de acerto total ((+ e DICA) ÷ total) */
  pctTotal: number | null
  occurrences: number
  /** soma das durações (s) */
  seconds: number
  /** sequência das marcações: "+", "D", "−" */
  sequence: ('+' | 'D' | '−')[]
}

/** Contas da seção 7.1 (tentativas desfeitas não contam). */
export function targetStats(trials: LocalTrial[]): TargetStats {
  const active = trials.filter((t) => !t.deleted_at).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  const withResult = active.filter((t) => t.result)
  const correct = withResult.filter((t) => t.result === 'acerto').length
  const prompted = withResult.filter((t) => t.result === 'dica').length
  const errors = withResult.filter((t) => t.result === 'erro').length
  const total = withResult.length
  const valued = active.filter((t) => t.value != null)
  return {
    total,
    correct,
    prompted,
    errors,
    pctIndependent: total ? Math.round((correct / total) * 100) : null,
    pctTotal: total ? Math.round(((correct + prompted) / total) * 100) : null,
    occurrences: valued.length,
    seconds: valued.reduce((s, t) => s + (t.value ?? 0), 0),
    sequence: withResult.map((t) => (t.result === 'acerto' ? '+' : t.result === 'dica' ? 'D' : '−')),
  }
}

/** "1min 05s", "42s", "1h 02min" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m) return `${m}min ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

/** Cronômetro "12:05" / "1:02:09" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`
}

/** Percentual com o número de tentativas junto (50% de 2 ≠ 50% de 20). */
export function pctLabel(st: Pick<TargetStats, 'pctIndependent' | 'correct' | 'total'>): string {
  if (!st.total) return 'sem tentativas'
  return `${st.pctIndependent}% (${st.correct}/${st.total})`
}

import { Award, CalendarCheck, ClipboardCheck, Percent } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { LearnerDetail } from '@/features/learners/api'
import { useLearnerPrograms, useProgramStats, type ProgramListItem } from '@/features/programs/api'
import { formatDuration } from '@/features/collection/stats'
import { formatDate, formatDateOnly } from '@/lib/dates'

import { useLearnerMilestones, useLearnerSessions, type SessionRow } from './api'
import { MeasureChart, PercentChart, type MeasurePoint, type PercentPoint } from './charts'
import { inPeriod, PERIOD_LABEL, PeriodPicker, usePeriod } from './period'

type Mode = 'aquisicao' | 'reducao'

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon} {label}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

const sessionTitle = (s: SessionRow) => `${s.number ? `Sessão #${s.number}` : 'Sessão'} · ${formatDate(s.started_at)}`
const sessionLabel = (s: SessionRow) => (s.number ? `#${s.number}` : formatDate(s.started_at).slice(0, 5))

/** Gráfico de um programa de frequência ou duração (um valor por sessão). */
export function measurePoints(program: Pick<ProgramListItem, 'id' | 'measure_type'>, sessions: SessionRow[], rows: { learner_program_id: string; session_id: string; occurrences: number; value_total: number }[]): MeasurePoint[] {
  const bySession = new Map(rows.filter((r) => r.learner_program_id === program.id).map((r) => [r.session_id, r]))
  return sessions
    .filter((s) => bySession.has(s.id))
    .map((s) => {
      const r = bySession.get(s.id)!
      const hours = (s.duration_seconds ?? 0) / 3600
      if (program.measure_type === 'frequencia') {
        const perHour = hours > 0 ? (r.value_total / hours).toFixed(1).replace('.', ',') : '—'
        return {
          key: s.id,
          label: sessionLabel(s),
          title: sessionTitle(s),
          value: r.value_total,
          detail: `${r.value_total} ${r.value_total === 1 ? 'ocorrência' : 'ocorrências'} · ${perHour} por hora`,
        }
      }
      const mean = r.occurrences ? r.value_total / r.occurrences : 0
      return {
        key: s.id,
        label: sessionLabel(s),
        title: sessionTitle(s),
        value: Math.round((r.value_total / 60) * 10) / 10,
        detail: `${formatDuration(r.value_total)} no total · média ${formatDuration(mean)} por vez (${r.occurrences}×)`,
      }
    })
}

export function PerformanceTab({ learner }: { learner: LearnerDetail }) {
  const [period, setPeriod] = usePeriod('30')
  const [mode, setMode] = useState<Mode>('aquisicao')
  const sessions = useLearnerSessions(learner.id)
  const stats = useProgramStats(learner.id)
  const programs = useLearnerPrograms(learner.id)
  const milestones = useLearnerMilestones(learner.id)

  const inRange = useMemo(
    () => (sessions.data ?? []).filter((s) => s.status === 'finalizada' && inPeriod(s.started_at, period)).sort((a, b) => a.started_at.localeCompare(b.started_at)),
    [sessions.data, period],
  )
  const programById = useMemo(() => new Map((programs.data ?? []).map((p) => [p.id, p])), [programs.data])

  // Aquisição (tipo Tentativa): % independente por sessão somando todos os programas
  const acquisition = useMemo(() => {
    const ids = new Set(inRange.map((s) => s.id))
    const agg = new Map<string, { correct: number; total: number }>()
    for (const r of stats.data ?? []) {
      const p = programById.get(r.learner_program_id)
      if (!ids.has(r.session_id) || p?.goal !== 'aquisicao' || p.measure_type !== 'tentativa') continue
      const a = agg.get(r.session_id) ?? { correct: 0, total: 0 }
      a.correct += r.correct_independent
      a.total += r.trials_total
      agg.set(r.session_id, a)
    }
    const points: PercentPoint[] = inRange
      .filter((s) => agg.get(s.id)?.total)
      .map((s) => {
        const a = agg.get(s.id)!
        return { key: s.id, label: sessionLabel(s), title: sessionTitle(s), correct: a.correct, total: a.total, pct: Math.round((a.correct / a.total) * 100) }
      })
    const correct = points.reduce((n, p) => n + p.correct, 0)
    const total = points.reduce((n, p) => n + p.total, 0)
    return { points, correct, total, pct: total ? Math.round((correct / total) * 100) : null }
  }, [inRange, stats.data, programById])

  const measurePrograms = (programs.data ?? []).filter((p) => (mode === 'reducao' ? p.goal === 'reducao' : p.goal === 'aquisicao' && p.measure_type !== 'tentativa'))
  const reductionTrials = (programs.data ?? []).filter((p) => mode === 'reducao' && p.goal === 'reducao' && p.measure_type === 'tentativa')

  const masteredCount = (milestones.data?.mastered ?? []).filter((m) => inPeriod(m.changed_at, period)).length
  const concludedCount = (milestones.data?.concluded ?? []).filter((c) => inPeriod(c.updated_at, period)).length
  const loading = sessions.isPending || stats.isPending || programs.isPending

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PeriodPicker value={period} onChange={setPeriod} id="perf-periodo" />
        <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Tipo de programa">
          {(
            [
              ['aquisicao', 'Aquisição'],
              ['reducao', 'Redução'],
            ] as const
          ).map(([v, l]) => (
            <Button key={v} role="tab" aria-selected={mode === v} variant={mode === v ? 'default' : 'ghost'} className="min-w-28" onClick={() => setMode(v)}>
              {l}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<CalendarCheck className="size-4" aria-hidden />} label="Sessões realizadas" value={loading ? '…' : inRange.length} />
        <Stat icon={<ClipboardCheck className="size-4" aria-hidden />} label="Programas concluídos" value={milestones.isPending ? '…' : concludedCount} />
        <Stat icon={<Award className="size-4" aria-hidden />} label="Alvos masterizados" value={milestones.isPending ? '…' : masteredCount} />
        <Stat
          icon={<Percent className="size-4" aria-hidden />}
          label="Acerto independente"
          value={acquisition.pct == null ? '—' : `${acquisition.pct}%`}
          hint={acquisition.total ? `${acquisition.correct} de ${acquisition.total} tentativas` : 'aquisição, no período'}
        />
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : (
        <>
          {mode === 'aquisicao' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">% de acerto independente por sessão</CardTitle>
                <CardDescription className="text-base">
                  Programas de aquisição do tipo Tentativa · {PERIOD_LABEL[period.key].toLowerCase()}
                  {period.key === 'custom' && ` (${formatDateOnly(period.from)} a ${formatDateOnly(period.to)})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PercentChart points={acquisition.points} ariaLabel="Gráfico de porcentagem de acerto independente por sessão" />
              </CardContent>
            </Card>
          )}

          {mode === 'reducao' && measurePrograms.length === 0 && reductionTrials.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-base text-muted-foreground">Nenhum programa de redução para este aprendiz.</CardContent>
            </Card>
          )}

          {measurePrograms.map((p) => {
            const points = measurePoints(p, inRange, stats.data ?? [])
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    <Link to={`/aprendizes/${learner.id}/programas/${p.id}?aba=evolucao`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="text-base">
                    {p.measure_type === 'frequencia' ? 'Ocorrências por sessão (a média por hora aparece ao tocar na barra)' : 'Minutos por sessão (a média por vez aparece ao tocar na barra)'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MeasureChart points={points} unit={p.measure_type === 'frequencia' ? 'ocorrências' : 'minutos'} ariaLabel={`Gráfico de ${p.name}`} />
                </CardContent>
              </Card>
            )
          })}

          {reductionTrials.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-lg">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-base text-muted-foreground">
                Programa de redução do tipo Tentativa: veja o gráfico de cada alvo na{' '}
                <Link className="text-primary underline" to={`/aprendizes/${learner.id}/programas/${p.id}?aba=evolucao`}>
                  página do programa
                </Link>
                .
              </CardContent>
            </Card>
          ))}

          {mode === 'aquisicao' && (
            <p className="text-sm text-muted-foreground">O gráfico de cada alvo, colorido pelo nível de ajuda, fica na aba Evolução de cada programa.</p>
          )}
        </>
      )}
    </div>
  )
}

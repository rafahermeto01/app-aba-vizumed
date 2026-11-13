import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTargetStats, type ProgramDetail } from '@/features/programs/api'
import { TARGET_STATUS_LABEL, TARGET_STATUS_ORDER } from '@/features/programs/constants'
import { PromptLevelBadge } from '@/features/programs/PromptLevelBadge'
import { usePromptLevels } from '@/features/programs/usePromptLevels'
import { formatDate } from '@/lib/dates'

import { useLearnerSessions } from './api'
import { MeasureChart, PercentChart, type MeasurePoint, type PercentPoint } from './charts'
import { measurePoints } from './PerformanceTab'
import { inPeriod, PeriodPicker, usePeriod } from './period'

/**
 * Aba Evolução do programa: um gráfico por alvo. Para Tentativa, % de acerto
 * independente por sessão com o fundo/pontos coloridos pelo nível de ajuda
 * vigente e linhas verticais nas mudanças de nível (seção 7.3).
 */
export function ProgramEvolution({ program }: { program: ProgramDetail }) {
  const [period, setPeriod] = usePeriod('90')
  const levels = usePromptLevels()
  const sessions = useLearnerSessions(program.learner_id)
  const targetIds = useMemo(() => program.targets.map((t) => t.id), [program.targets])
  const stats = useTargetStats(targetIds)

  const sessionById = useMemo(() => new Map((sessions.data ?? []).map((s) => [s.id, s])), [sessions.data])
  const isTrial = program.measure_type === 'tentativa'

  const perTarget = useMemo(() => {
    const rows = (stats.data ?? []).filter((r) => r.session_status === 'finalizada' && inPeriod(r.started_at, period))
    const map = new Map<string, typeof rows>()
    for (const r of rows) {
      const list = map.get(r.target_id)
      if (list) list.push(r)
      else map.set(r.target_id, [r])
    }
    for (const list of map.values()) list.sort((a, b) => a.started_at.localeCompare(b.started_at))
    return map
  }, [stats.data, period])

  const ordered = TARGET_STATUS_ORDER.flatMap((st) => program.targets.filter((t) => t.status === st))
  const withData = ordered.filter((t) => perTarget.has(t.id))
  const withoutData = ordered.filter((t) => !perTarget.has(t.id))

  if (stats.isPending || sessions.isPending) return <Skeleton className="h-72 w-full rounded-xl" />

  return (
    <div className="flex flex-col gap-5">
      <PeriodPicker value={period} onChange={setPeriod} id="prog-periodo" />

      {withData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-base text-muted-foreground">Nenhum alvo com registros neste período.</CardContent>
        </Card>
      )}

      {withData.map((t) => {
        const rows = perTarget.get(t.id)!
        const label = (sid: string, at: string) => {
          const s = sessionById.get(sid)
          return s?.number ? `#${s.number}` : formatDate(at).slice(0, 5)
        }
        const title = (sid: string, at: string) => {
          const s = sessionById.get(sid)
          return `${s?.number ? `Sessão #${s.number}` : 'Sessão'} · ${formatDate(at)}`
        }

        if (isTrial) {
          const points: PercentPoint[] = rows.map((r) => {
            const lvl = r.prompt_level_id ? levels.byId.get(r.prompt_level_id) : undefined
            return {
              key: r.session_id,
              label: label(r.session_id, r.started_at),
              title: title(r.session_id, r.started_at),
              pct: r.trials_total ? Math.round(r.pct_independent ?? 0) : null,
              correct: r.correct_independent,
              total: r.trials_total,
              level: lvl ? { abbreviation: lvl.abbreviation, name: lvl.name, color: lvl.color } : null,
            }
          })
          // Distribuição de ajuda: tentativas em cada nível no período
          const dist = new Map<string, number>()
          for (const r of rows) if (r.prompt_level_id) dist.set(r.prompt_level_id, (dist.get(r.prompt_level_id) ?? 0) + r.trials_total)
          const total = rows.reduce((n, r) => n + r.trials_total, 0)
          const correct = rows.reduce((n, r) => n + r.correct_independent, 0)
          return (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  {t.name} <Badge variant="outline">{TARGET_STATUS_LABEL[t.status]}</Badge>
                </CardTitle>
                <CardDescription className="text-base">
                  {total ? `${Math.round((correct / total) * 100)}% independente no período · ${correct} de ${total} tentativas em ${rows.length} ${rows.length === 1 ? 'sessão' : 'sessões'}` : 'Sem tentativas'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <PercentChart
                  points={points}
                  criterion={program.goal === 'aquisicao' ? program.mastery_min_pct : undefined}
                  ariaLabel={`Evolução do alvo ${t.name}: porcentagem de acerto independente por sessão, colorida pelo nível de ajuda`}
                />
                {dist.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Tentativas por nível de ajuda:</span>
                    {[...dist.entries()]
                      .sort((a, b) => (levels.byId.get(a[0])?.sort_order ?? 0) - (levels.byId.get(b[0])?.sort_order ?? 0))
                      .map(([lid, n]) => (
                        <span key={lid} className="inline-flex items-center gap-1">
                          <PromptLevelBadge level={levels.byId.get(lid)} className="h-6" /> {n}
                        </span>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        }

        // Frequência / duração: um valor por sessão
        const sess = rows.map((r) => sessionById.get(r.session_id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
        const points: MeasurePoint[] = measurePoints(
          { id: program.id, measure_type: program.measure_type },
          sess,
          rows.map((r) => ({ learner_program_id: program.id, session_id: r.session_id, occurrences: r.occurrences, value_total: r.value_total })),
        )
        return (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {t.name} <Badge variant="outline">{TARGET_STATUS_LABEL[t.status]}</Badge>
              </CardTitle>
              <CardDescription className="text-base">{program.measure_type === 'frequencia' ? 'Ocorrências por sessão' : 'Minutos por sessão'}</CardDescription>
            </CardHeader>
            <CardContent>
              <MeasureChart points={points} unit={program.measure_type === 'frequencia' ? 'ocorrências' : 'minutos'} ariaLabel={`Evolução do alvo ${t.name}`} />
            </CardContent>
          </Card>
        )
      })}

      {withoutData.length > 0 && (
        <p className="text-sm text-muted-foreground">Sem registros no período: {withoutData.map((t) => t.name).join(', ')}.</p>
      )}
    </div>
  )
}

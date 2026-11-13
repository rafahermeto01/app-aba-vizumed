import { House } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenLoader } from '@/features/auth/RequireAuth'
import { GOAL_LABEL } from '@/features/programs/constants'
import { PromptLevelBadge } from '@/features/programs/PromptLevelBadge'
import { formatDateTime } from '@/lib/dates'
import { useLocalSession, useSessionTrials } from '@/offline/hooks'

import { RATINGS } from './FinalizePage'
import { Shell } from './Shell'
import { formatDuration, pctLabel, targetStats } from './stats'

/** Resumo da sessão (depois de finalizar). Funciona sem internet. */
export function SummaryPage() {
  const { sessionId } = useParams()
  const session = useLocalSession(sessionId)
  const trials = useSessionTrials(sessionId)
  if (session === undefined) return <FullScreenLoader />
  if (!session) return <Navigate to="/" replace />
  if (session.status !== 'finalizada') return <Navigate to={`/sessao/${session.id}`} replace />

  const all = targetStats(trials.filter((t) => session.programs.find((p) => p.id === t.program_id)?.measure_type === 'tentativa'))
  const levelById = new Map(session.levels.map((l) => [l.id, l]))
  const rating = RATINGS.find((r) => r.value === session.rating)

  return (
    <Shell
      showSaved
      title={session.number ? `Sessão #${session.number}` : 'Sessão registrada'}
      subtitle={`${session.learner_name} · ${formatDateTime(session.started_at)}`}
      footer={
        <Button asChild size="lg" className="h-14 w-full text-lg">
          <Link to="/" replace>
            <House aria-hidden /> Voltar para a tela inicial
          </Link>
        </Button>
      }
    >
      {!session.number && (
        <p className="text-sm text-muted-foreground">O número da sessão aparece quando ela chegar ao servidor (sincronizando).</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Card className="gap-1 py-4">
          <CardContent className="px-3 text-center">
            <p className="text-3xl font-bold tabular-nums">{all.total ? `${all.pctIndependent}%` : '—'}</p>
            <p className="text-sm text-muted-foreground">acerto independente</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-3 text-center">
            <p className="text-3xl font-bold tabular-nums">{all.total}</p>
            <p className="text-sm text-muted-foreground">tentativas</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{formatDuration(session.duration_seconds ?? 0)}</p>
            <p className="text-sm text-muted-foreground">duração</p>
          </CardContent>
        </Card>
      </div>

      {session.programs.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {p.name} <Badge variant="secondary">{GOAL_LABEL[p.goal]}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {p.targets.map((t) => {
                const st = targetStats(trials.filter((x) => x.target_id === t.id))
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 text-base">
                      {p.measure_type === 'tentativa' && <PromptLevelBadge level={t.level_id ? levelById.get(t.level_id) : undefined} className="h-6" />}
                      {t.name}
                    </span>
                    <span className="text-base font-medium tabular-nums">
                      {p.measure_type === 'tentativa'
                        ? pctLabel(st)
                        : p.measure_type === 'frequencia'
                          ? `${st.occurrences} ${st.occurrences === 1 ? 'ocorrência' : 'ocorrências'}`
                          : `${formatDuration(st.seconds)} (${st.occurrences}×)`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="flex flex-col gap-2 text-base">
          <p>
            <span className="text-muted-foreground">Avaliação:</span> {rating ? rating.label : 'não informada'}
          </p>
          {session.notes && (
            <p className="whitespace-pre-line">
              <span className="text-muted-foreground">Notas:</span> {session.notes}
            </p>
          )}
          <p className="text-muted-foreground">Assinado por {session.applicator_name}.</p>
        </CardContent>
      </Card>
    </Shell>
  )
}

import { ChevronRight, CirclePlay, ClipboardPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useLearnerSessions, type SessionRow } from '@/features/evolution/api'
import { inPeriod, PeriodPicker, sessionGroupLabel, usePeriod } from '@/features/evolution/period'
import type { LearnerDetail } from '@/features/learners/api'
import { useTeam } from '@/features/team/api'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { useLocalSessions, useOpenSessions, useUnsyncedSessionIds } from '@/offline/hooks'

import { formatDuration } from './stats'

type Row = SessionRow & { localOnly: boolean }
const ALL = 'todos'

/** Aba Sessões: lista agrupada por semana/mês, filtros e botão "Registrar sessão". */
export function SessionsTab({ learner }: { learner: LearnerDetail }) {
  const { profile } = useAuth()
  const team = useTeam()
  const open = useOpenSessions(profile?.id, learner.id)
  const local = useLocalSessions(profile?.id, learner.id)
  const unsynced = useUnsyncedSessionIds(profile?.id)
  const remote = useLearnerSessions(learner.id)
  const [period, setPeriod] = usePeriod('30')
  const [applicator, setApplicator] = useState(ALL)
  const [status, setStatus] = useState<'todos' | 'finalizada' | 'em_andamento'>(ALL)
  const member = useMemo(() => new Map((team.data ?? []).map((m) => [m.id, m])), [team.data])

  // Junta o servidor com o que só está neste aparelho (ainda sincronizando)
  const rows = useMemo(() => {
    const byId = new Map<string, Row>()
    for (const r of remote.data ?? []) byId.set(r.id, { ...r, localOnly: false })
    for (const s of local) {
      if (byId.has(s.id) || s.status === 'em_andamento') continue
      byId.set(s.id, {
        id: s.id,
        number: s.number,
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_seconds: s.duration_seconds,
        status: s.status,
        rating: s.rating,
        notes: s.notes,
        applicator_id: s.user_id,
        applicator_signature_path: null,
        programs_count: s.programs.length,
        targets_count: 0,
        trials_total: 0,
        correct_independent: 0,
        prompted: 0,
        occurrences: 0,
        localOnly: true,
      })
    }
    return [...byId.values()].sort((a, b) => b.started_at.localeCompare(a.started_at))
  }, [remote.data, local])

  const applicators = useMemo(() => [...new Set(rows.map((r) => r.applicator_id))], [rows])
  const filtered = rows.filter(
    (r) => inPeriod(r.started_at, period) && (applicator === ALL || r.applicator_id === applicator) && (status === ALL || r.status === status) && !open.some((o) => o.id === r.id),
  )
  const groups = useMemo(() => {
    const g: { label: string; items: Row[] }[] = []
    for (const r of filtered) {
      const label = sessionGroupLabel(r.started_at)
      const last = g[g.length - 1]
      if (last?.label === label) last.items.push(r)
      else g.push({ label, items: [r] })
    }
    return g
  }, [filtered])

  return (
    <div className="flex flex-col gap-4">
      {open.map((s) => (
        <Card key={s.id} className="border-primary bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-base font-medium">Sessão em andamento neste aparelho</p>
              <p className="text-sm text-muted-foreground">Iniciada {timeAgo(s.started_at)} · tudo salvo no aparelho</p>
            </div>
            <Button asChild size="lg">
              <Link to={`/sessao/${s.id}`}>
                <CirclePlay aria-hidden /> Continuar
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <PeriodPicker value={period} onChange={setPeriod} id="sess-periodo" />
        <div className="grid grid-cols-2 gap-3 md:flex">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sess-aplicador">Aplicador</Label>
            <Select value={applicator} onValueChange={setApplicator}>
              <SelectTrigger id="sess-aplicador" className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {applicators.map((id) => (
                  <SelectItem key={id} value={id}>
                    {member.get(id)?.full_name ?? (id === profile?.id ? profile.full_name : 'Profissional')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sess-status">Situação</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger id="sess-status" className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                <SelectItem value="finalizada">Finalizadas</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {remote.isPending && rows.length === 0 ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-base text-muted-foreground">
            {rows.length === 0 ? 'Nenhuma sessão registrada ainda.' : 'Nenhuma sessão com esses filtros.'}
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.label} aria-labelledby={`g-${g.label}`} className="flex flex-col gap-2">
            <h2 id={`g-${g.label}`} className="text-base font-semibold text-muted-foreground">
              {g.label} <span className="font-normal">({g.items.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {g.items.map((r) => {
                const m = member.get(r.applicator_id)
                const pct = r.trials_total ? Math.round((r.correct_independent / r.trials_total) * 100) : null
                const href = r.localOnly ? `/sessao/${r.id}/resumo` : `/aprendizes/${learner.id}/sessoes/${r.id}`
                return (
                  <li key={r.id}>
                    <Link to={href} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                      <Card className="py-3 transition-colors hover:bg-muted/40">
                        <CardContent className="flex items-center gap-3">
                          <PersonAvatar name={m?.full_name ?? '?'} photoPath={m?.photo_path} bucket="profile-photos" className="size-10" />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-base font-medium">
                              {r.number ? `Sessão #${r.number}` : 'Sessão'}
                              <span className="font-normal text-muted-foreground">{formatDateTime(r.started_at)}</span>
                              {r.status === 'em_andamento' && <Badge variant="outline">Em andamento</Badge>}
                              {unsynced.has(r.id) && <Badge variant="outline">Sincronizando</Badge>}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {m?.full_name ?? 'Profissional'}
                              {r.duration_seconds != null && ` · ${formatDuration(r.duration_seconds)}`}
                              {` · ${r.programs_count} ${r.programs_count === 1 ? 'programa' : 'programas'}`}
                              {!r.localOnly && ` · ${r.targets_count} ${r.targets_count === 1 ? 'alvo' : 'alvos'}`}
                            </p>
                            {r.notes && <p className="line-clamp-1 text-sm text-muted-foreground italic">“{r.notes}”</p>}
                          </div>
                          {pct != null && (
                            <div className="text-right">
                              <p className="text-lg font-semibold tabular-nums">{pct}%</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {r.correct_independent}/{r.trials_total}
                              </p>
                            </div>
                          )}
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      {/* Botão flutuante */}
      {open.length === 0 && (
        <Button asChild size="lg" className="fixed right-4 bottom-24 z-30 h-14 rounded-full px-6 text-base shadow-lg md:right-8 md:bottom-8">
          <Link to={`/aprendizes/${learner.id}/sessao/nova`}>
            <ClipboardPlus className="size-5" aria-hidden /> Registrar sessão
          </Link>
        </Button>
      )}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { CirclePlay, ClipboardPlus } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthProvider'
import type { LearnerDetail } from '@/features/learners/api'
import { useTeam } from '@/features/team/api'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import { useLocalSessions, useOpenSessions, useUnsyncedSessionIds } from '@/offline/hooks'

import { formatDuration } from './stats'

type Row = {
  id: string
  number: number | null
  started_at: string
  duration_seconds: number | null
  status: 'em_andamento' | 'finalizada'
  applicator_id: string
  local: boolean
}

/** Aba Sessões (fase 4: registrar e continuar; a lista completa com filtros vem na fase 5). */
export function SessionsTab({ learner }: { learner: LearnerDetail }) {
  const { profile } = useAuth()
  const team = useTeam()
  const open = useOpenSessions(profile?.id, learner.id)
  const local = useLocalSessions(profile?.id, learner.id)
  const unsynced = useUnsyncedSessionIds(profile?.id)
  const who = new Map((team.data ?? []).map((m) => [m.id, m.full_name]))

  const remote = useQuery({
    queryKey: ['learner-sessions', learner.id],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, number, started_at, duration_seconds, status, applicator_id')
        .eq('learner_id', learner.id)
        .is('deleted_at', null)
        .order('started_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data.map((s) => ({ ...s, local: false }))
    },
  })

  // Junta o que está no servidor com o que só está no aparelho (ainda sincronizando)
  const byId = new Map<string, Row>()
  for (const r of remote.data ?? []) byId.set(r.id, r)
  for (const s of local) {
    if (s.status === 'em_andamento') continue
    const server = byId.get(s.id)
    byId.set(s.id, {
      id: s.id,
      number: server?.number ?? s.number,
      started_at: s.started_at,
      duration_seconds: s.duration_seconds,
      status: s.status,
      applicator_id: s.user_id,
      local: true,
    })
  }
  const rows = [...byId.values()].filter((r) => r.status === 'finalizada' || !open.some((o) => o.id === r.id)).sort((a, b) => b.started_at.localeCompare(a.started_at))

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

      <h2 className="text-lg font-semibold">Sessões recentes</h2>
      {rows.length === 0 ? (
        <p className="text-base text-muted-foreground">{remote.isPending ? 'Carregando…' : 'Nenhuma sessão registrada ainda.'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="py-3">
                <CardContent className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">
                      {r.number ? `Sessão #${r.number}` : 'Sessão'} · {formatDateTime(r.started_at)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {who.get(r.applicator_id) ?? (r.applicator_id === profile?.id ? profile.full_name : 'Profissional')}
                      {r.duration_seconds != null && ` · ${formatDuration(r.duration_seconds)}`}
                    </p>
                  </div>
                  {r.status === 'em_andamento' && <Badge variant="outline">Em andamento</Badge>}
                  {unsynced.has(r.id) && <Badge variant="outline">Sincronizando</Badge>}
                  {r.local && r.status === 'finalizada' && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/sessao/${r.id}/resumo`}>Resumo</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">A lista completa, com filtros e detalhes de cada sessão, chega na fase 5.</p>

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

import { ArrowDown, ArrowUp, Check, ChevronRight, ClipboardList, ListMusic, ListOrdered, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import type { LearnerDetail } from '@/features/learners/api'
import { useTeam } from '@/features/team/api'
import { timeAgo } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'

import { canManageLearner, useLearnerPrograms, useProgramStats, useReorderPrograms, type ProgramListItem } from './api'
import { GOAL_LABEL, MEASURE_SHORT, PROGRAM_STATUS_LABEL, type MeasureType, type ProgramStatus } from './constants'
import { MiniChart } from './MiniChart'
import { PlaylistsDialog } from './PlaylistsDialog'

const ALL = 'todos'

function targetSummary(c: ProgramListItem['counts']) {
  const parts = [
    c.intervencao && `${c.intervencao} em intervenção`,
    c.fila && `${c.fila} na fila`,
    c.manutencao && `${c.manutencao} em manutenção`,
    c.masterizado && `${c.masterizado} ${c.masterizado === 1 ? 'masterizado' : 'masterizados'}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sem alvos'
}

export function ProgramsTab({ learner }: { learner: LearnerDetail }) {
  const { profile } = useAuth()
  const programs = useLearnerPrograms(learner.id)
  const stats = useProgramStats(learner.id)
  const team = useTeam()
  const reorder = useReorderPrograms(learner.id)
  const canManage = canManageLearner(profile, learner)

  const [status, setStatus] = useState<ProgramStatus | typeof ALL>('ativo')
  const [measure, setMeasure] = useState<MeasureType | typeof ALL>(ALL)
  const [applicator, setApplicator] = useState<string>(ALL)
  const [onlyMine, setOnlyMine] = useState(false)
  const [ordering, setOrdering] = useState<string[] | null>(null)
  const [playlistsOpen, setPlaylistsOpen] = useState(false)

  const member = useMemo(() => new Map((team.data ?? []).map((m) => [m.id, m])), [team.data])

  // Agrega o desempenho por programa
  const byProgram = useMemo(() => {
    const map = new Map<string, { sessions: { at: string; pct: number | null; value: number }[]; trials: number; applicators: Set<string>; last: string | null }>()
    for (const s of stats.data ?? []) {
      let e = map.get(s.learner_program_id)
      if (!e) {
        e = { sessions: [], trials: 0, applicators: new Set(), last: null }
        map.set(s.learner_program_id, e)
      }
      e.sessions.push({ at: s.started_at, pct: s.pct_independent, value: s.value_total })
      e.trials += s.trials_total + s.occurrences
      e.applicators.add(s.applicator_id)
      if (!e.last || s.started_at > e.last) e.last = s.started_at
    }
    return map
  }, [stats.data])

  const applicatorOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const s of stats.data ?? []) ids.add(s.applicator_id)
    return [...ids].map((id) => ({ id, name: member.get(id)?.full_name ?? 'Profissional' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [stats.data, member])

  const list = useMemo(() => {
    const all = programs.data ?? []
    if (ordering) return ordering.map((id) => all.find((p) => p.id === id)!).filter(Boolean)
    return all.filter((p) => {
      if (status !== ALL && p.status !== status) return false
      if (measure !== ALL && p.measure_type !== measure) return false
      const apps = byProgram.get(p.id)?.applicators
      if (onlyMine && !apps?.has(profile?.id ?? '')) return false
      if (applicator !== ALL && !apps?.has(applicator)) return false
      return true
    })
  }, [programs.data, ordering, status, measure, onlyMine, applicator, byProgram, profile?.id])

  function moveInOrder(i: number, d: number) {
    if (!ordering) return
    const next = [...ordering]
    const [it] = next.splice(i, 1)
    next.splice(i + d, 0, it)
    setOrdering(next)
  }

  async function saveOrder() {
    if (!ordering) return
    try {
      await reorder.mutateAsync(ordering)
      toast.success('Ordem salva.')
      setOrdering(null)
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {canManage && !ordering && (
          <Button asChild>
            <Link to={`/aprendizes/${learner.id}/programas/novo`}>
              <Plus aria-hidden /> Novo programa
            </Link>
          </Button>
        )}
        {canManage && !ordering && (programs.data?.length ?? 0) > 1 && (
          <Button variant="outline" onClick={() => setOrdering((programs.data ?? []).map((p) => p.id))}>
            <ListOrdered aria-hidden /> Ordenar
          </Button>
        )}
        {ordering && (
          <>
            <Button onClick={() => void saveOrder()} disabled={reorder.isPending}>
              <Check aria-hidden /> Salvar ordem
            </Button>
            <Button variant="outline" onClick={() => setOrdering(null)}>
              Cancelar
            </Button>
          </>
        )}
        {!ordering && (
          <Button variant="outline" onClick={() => setPlaylistsOpen(true)}>
            <ListMusic aria-hidden /> Playlists
          </Button>
        )}
      </div>

      {/* Filtros */}
      {!ordering && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={status} onValueChange={(v) => setStatus(v as ProgramStatus)}>
            <SelectTrigger className="w-full" aria-label="Situação do programa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="pausado">Pausados</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value={ALL}>Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={measure} onValueChange={(v) => setMeasure(v as MeasureType)}>
            <SelectTrigger className="w-full" aria-label="Tipo de medida">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              {(Object.keys(MEASURE_SHORT) as MeasureType[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {MEASURE_SHORT[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={applicator} onValueChange={setApplicator}>
            <SelectTrigger className="w-full" aria-label="Aplicador">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Qualquer aplicador</SelectItem>
              {applicatorOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label htmlFor="only-mine" className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 md:min-h-10">
            <Checkbox id="only-mine" checked={onlyMine} onCheckedChange={(c) => setOnlyMine(c === true)} />
            <span className="text-base md:text-sm">Apenas os que eu apliquei</span>
          </label>
        </div>
      )}

      {programs.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : programs.isError ? (
        <Card>
          <CardContent className="text-base text-muted-foreground">Não foi possível carregar os programas. Verifique sua conexão.</CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-base text-muted-foreground">
              {(programs.data ?? []).length === 0
                ? canManage
                  ? 'Nenhum programa ainda. Comece pela biblioteca ou crie do zero.'
                  : 'Nenhum programa cadastrado ainda.'
                : 'Nenhum programa com esses filtros.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((p, i) => {
            const st = byProgram.get(p.id)
            const last5 = (st?.sessions ?? []).slice(-5)
            const values = last5.map((s) => (p.measure_type === 'tentativa' ? (s.pct ?? 0) : s.value))
            const apps = [...(st?.applicators ?? [])]
            const body = (
              <Card className={ordering ? '' : 'transition-colors hover:bg-muted/40'}>
                <CardContent className="flex items-center gap-4 py-1">
                  {ordering && (
                    <div className="flex flex-col">
                      <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => moveInOrder(i, -1)} aria-label={`Subir ${p.name}`}>
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={i === list.length - 1} onClick={() => moveInOrder(i, 1)} aria-label={`Descer ${p.name}`}>
                        <ArrowDown aria-hidden />
                      </Button>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">{p.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{GOAL_LABEL[p.goal]}</Badge>
                      <Badge variant="outline">{MEASURE_SHORT[p.measure_type]}</Badge>
                      {p.status !== 'ativo' && <Badge variant="outline">{PROGRAM_STATUS_LABEL[p.status]}</Badge>}
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{targetSummary(p.counts)}</p>
                    <p className="text-sm text-muted-foreground">
                      {st ? `${st.trials} registros · ${st.sessions.length} ${st.sessions.length === 1 ? 'sessão' : 'sessões'} · última ${timeAgo(st.last!)}` : 'Ainda não aplicado'}
                    </p>
                  </div>
                  {!ordering && (
                    <div className="hidden flex-col items-end gap-2 sm:flex">
                      <MiniChart values={values} percent={p.measure_type === 'tentativa'} />
                      {apps.length > 0 && (
                        <div className="flex -space-x-2" aria-label="Quem aplicou">
                          {apps.slice(0, 3).map((id) => {
                            const m = member.get(id)
                            return (
                              <PersonAvatar
                                key={id}
                                name={m?.full_name ?? '?'}
                                photoPath={m?.photo_path}
                                bucket="profile-photos"
                                className="size-7 text-[11px] ring-2 ring-card"
                              />
                            )
                          })}
                          {apps.length > 3 && (
                            <span className="grid size-7 place-items-center rounded-full bg-muted text-[11px] ring-2 ring-card">+{apps.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!ordering && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                </CardContent>
              </Card>
            )
            return (
              <li key={p.id}>
                {ordering ? (
                  body
                ) : (
                  <Link to={`/aprendizes/${learner.id}/programas/${p.id}`} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    {body}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <PlaylistsDialog open={playlistsOpen} onOpenChange={setPlaylistsOpen} learnerId={learner.id} programs={programs.data ?? []} canManage={canManage} />
    </div>
  )
}

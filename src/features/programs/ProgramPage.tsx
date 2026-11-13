import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  History,
  ListPlus,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { RichTextView } from '@/components/RichText'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/AuthProvider'
import { useLearner } from '@/features/learners/api'
import { useTeam } from '@/features/team/api'
import { formatDate, formatDateOnly, formatDateTime } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'

import {
  canManageLearner,
  useMastery,
  useProgram,
  useProgramHistory,
  useRemoveProgram,
  useTargetActions,
  useTargetStats,
  useUpdateProgram,
  type ProgramDetail,
  type Target,
  type TargetSessionStat,
} from './api'
import {
  GOAL_LABEL,
  masteryText,
  MEASURE_LABEL,
  MEASURE_SHORT,
  PROGRAM_STATUS_LABEL,
  protocolText,
  TARGET_STATUS_LABEL,
  TARGET_STATUS_ORDER,
  type ProgramStatus,
  type TargetStatus,
} from './constants'
import { PromptLevelBadge } from './PromptLevelBadge'
import { LevelPicker, MasterDialog, RenameDialog } from './TargetDialogs'
import { usePromptLevels } from './usePromptLevels'

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
  const s = Math.round(total % 60)
  return m ? `${m}min ${String(s).padStart(2, '0')}s` : `${s}s`
}

function lastResult(measure: ProgramDetail['measure_type'], s: TargetSessionStat | undefined) {
  if (!s) return 'Ainda sem registros'
  const when = formatDate(s.started_at)
  if (measure === 'tentativa') {
    if (!s.trials_total) return `Última sessão (${when}): sem tentativas`
    return `Última sessão (${when}): ${Math.round(s.pct_independent ?? 0)}% independente · ${s.correct_independent} de ${s.trials_total} tentativas`
  }
  if (measure === 'frequencia') return `Última sessão (${when}): ${s.value_total} ${s.value_total === 1 ? 'ocorrência' : 'ocorrências'}`
  return `Última sessão (${when}): ${formatSeconds(s.value_total)} no total (${s.occurrences} ${s.occurrences === 1 ? 'vez' : 'vezes'})`
}

export function ProgramPage() {
  const { id: learnerId, programId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const learner = useLearner(learnerId)
  const program = useProgram(programId)
  const levels = usePromptLevels()
  const data = program.data
  const canManage = canManageLearner(profile, learner.data)

  const targetIds = useMemo(() => (data?.targets ?? []).map((t) => t.id), [data])
  const stats = useTargetStats(targetIds)
  const mastery = useMastery(programId)
  const actions = useTargetActions(learnerId ?? '', programId ?? '')
  const updateProgram = useUpdateProgram(learnerId ?? '', programId ?? '')
  const removeProgram = useRemoveProgram(learnerId ?? '')

  const [mastering, setMastering] = useState<{ target: Target; choice: 'masterizado' | 'manutencao' } | null>(null)
  const [renaming, setRenaming] = useState<Target | null>(null)
  const [removing, setRemoving] = useState<Target | null>(null)
  const [removingProgram, setRemovingProgram] = useState(false)
  const [newTargets, setNewTargets] = useState('')
  const [tab, setTab] = useState('alvos')
  const [historyFilter, setHistoryFilter] = useState<string | null>(null)

  useEffect(() => {
    if (data) document.title = `${data.name} · LovABA`
  }, [data])

  const lastByTarget = useMemo(() => {
    const m = new Map<string, TargetSessionStat>()
    for (const s of stats.data ?? []) if (!m.has(s.target_id)) m.set(s.target_id, s)
    return m
  }, [stats.data])

  const back = (
    <Button asChild variant="ghost" className="mb-2 -ml-3">
      <Link to={`/aprendizes/${learnerId}?aba=programas`}>
        <ArrowLeft aria-hidden /> {learner.data?.full_name ?? 'Aprendiz'}
      </Link>
    </Button>
  )

  if (program.isPending || learner.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-40 w-full rounded-xl" />
      </>
    )
  }
  if (!data || !learner.data) {
    return (
      <>
        {back}
        <Card>
          <CardContent className="py-10 text-center text-base text-muted-foreground">
            {program.isError ? 'Não foi possível carregar agora. Verifique sua conexão.' : 'Programa não encontrado, ou você não tem acesso a ele.'}
          </CardContent>
        </Card>
      </>
    )
  }

  const isTrial = data.measure_type === 'tentativa'
  const groups = TARGET_STATUS_ORDER.map((s) => ({ status: s, items: data.targets.filter((t) => t.status === s) }))
  const queue = groups.find((g) => g.status === 'fila')!.items
  const nextInQueue = queue[0]?.name ?? null
  const targetName = new Map(data.targets.map((t) => [t.id, t.name]))
  const readyCount = data.targets.filter((t) => mastery.data?.get(t.id)?.ready_to_master).length

  async function run<T>(p: Promise<T>, success: string) {
    try {
      await p
      toast.success(success)
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  async function changeStatus(t: Target, status: TargetStatus) {
    await run(actions.setStatus.mutateAsync({ targetId: t.id, status }), `“${t.name}” agora está em: ${TARGET_STATUS_LABEL[status]}.`)
  }

  async function moveQueue(index: number, delta: number) {
    const ids = queue.map((t) => t.id)
    const [it] = ids.splice(index, 1)
    ids.splice(index + delta, 0, it)
    await run(actions.reorder.mutateAsync(ids), 'Fila reordenada.')
  }

  async function addTargets() {
    const names = newTargets
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!names.length) return
    const refLevel = data!.targets.find((t) => t.status === 'intervencao')?.current_prompt_level_id ?? levels.active[0]?.id ?? null
    try {
      await actions.add.mutateAsync({ names, levelId: isTrial ? refLevel : null })
      setNewTargets('')
      toast.success(names.length === 1 ? 'Alvo adicionado à fila.' : `${names.length} alvos adicionados à fila.`)
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <>
      {back}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{data.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{GOAL_LABEL[data.goal]}</Badge>
            <Badge variant="outline">{MEASURE_SHORT[data.measure_type]}</Badge>
            {data.category_name && <Badge variant="outline">{data.category_name}</Badge>}
            {data.status !== 'ativo' && <Badge variant="outline">{PROGRAM_STATUS_LABEL[data.status]}</Badge>}
            {readyCount > 0 && (
              <Badge>
                <Sparkles aria-hidden /> {readyCount} {readyCount === 1 ? 'pronto' : 'prontos'} para masterizar
              </Badge>
            )}
          </div>
          {data.objective && <p className="mt-3 max-w-3xl text-base text-muted-foreground">{data.objective}</p>}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={data.status}
              onValueChange={(v) => void run(updateProgram.mutateAsync({ status: v as ProgramStatus }), `Programa ${PROGRAM_STATUS_LABEL[v as ProgramStatus].toLowerCase()}.`)}
            >
              <SelectTrigger className="w-40" aria-label="Situação do programa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">
                  <Play aria-hidden /> Ativo
                </SelectItem>
                <SelectItem value="pausado">
                  <Pause aria-hidden /> Pausado
                </SelectItem>
                <SelectItem value="concluido">
                  <Award aria-hidden /> Concluído
                </SelectItem>
              </SelectContent>
            </Select>
            <Button asChild variant="outline">
              <Link to={`/aprendizes/${learnerId}/programas/${data.id}/editar`}>
                <Pencil aria-hidden /> Editar
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações do programa">
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setRemovingProgram(true)}>
                  <Trash2 aria-hidden /> Remover programa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <TabsList>
            <TabsTrigger value="alvos">Alvos ({data.targets.length})</TabsTrigger>
            <TabsTrigger value="sobre">Sobre</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </div>

        {/* ALVOS */}
        <TabsContent value="alvos" className="mt-4 flex flex-col gap-6">
          {data.targets.length === 0 && <p className="text-base text-muted-foreground">Nenhum alvo ainda.</p>}
          {groups.map(({ status, items }) =>
            items.length === 0 ? null : (
              <section key={status} aria-labelledby={`grp-${status}`}>
                <h2 id={`grp-${status}`} className="mb-2 text-lg font-semibold">
                  {TARGET_STATUS_LABEL[status]} <span className="font-normal text-muted-foreground">({items.length})</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {items.map((t, i) => {
                    const ready = mastery.data?.get(t.id)?.ready_to_master
                    const level = t.current_prompt_level_id ? levels.byId.get(t.current_prompt_level_id) : undefined
                    return (
                      <li key={t.id}>
                        <Card className={status === 'masterizado' ? 'opacity-80' : ''}>
                          <CardContent className="flex items-center gap-3 py-1">
                            {canManage && status === 'fila' && (
                              <div className="flex flex-col">
                                <Button variant="ghost" size="icon" disabled={i === 0 || actions.reorder.isPending} onClick={() => void moveQueue(i, -1)} aria-label={`Subir ${t.name} na fila`}>
                                  <ArrowUp aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={i === items.length - 1 || actions.reorder.isPending}
                                  onClick={() => void moveQueue(i, 1)}
                                  aria-label={`Descer ${t.name} na fila`}
                                >
                                  <ArrowDown aria-hidden />
                                </Button>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {status === 'fila' && <span className="text-sm text-muted-foreground">{i + 1}º</span>}
                                <p className="text-base font-medium">{t.name}</p>
                                {ready && (
                                  <Badge>
                                    <Sparkles aria-hidden /> Pronto para masterizar
                                  </Badge>
                                )}
                              </div>
                              {status !== 'fila' && <p className="mt-1 text-sm text-muted-foreground">{lastResult(data.measure_type, lastByTarget.get(t.id))}</p>}
                              {status === 'manutencao' && t.next_maintenance_date && (
                                <p className="text-sm text-muted-foreground">
                                  Próxima revisão: {formatDateOnly(t.next_maintenance_date)} (a cada {t.maintenance_interval_days} dias)
                                </p>
                              )}
                              {status === 'masterizado' && t.mastered_at && <p className="text-sm text-muted-foreground">Masterizado em {formatDate(t.mastered_at)}</p>}
                            </div>
                            {isTrial && status !== 'masterizado' && (
                              <LevelPicker
                                current={level}
                                levels={levels.active}
                                disabled={!canManage}
                                targetName={t.name}
                                onPick={(levelId) =>
                                  void run(
                                    actions.setLevel.mutateAsync({ targetId: t.id, levelId }),
                                    `Nível de “${t.name}” mudou para ${levels.byId.get(levelId)?.abbreviation}. Vale a partir da próxima sessão.`,
                                  )
                                }
                              />
                            )}
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label={`Ações para ${t.name}`}>
                                    <MoreVertical aria-hidden />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-60">
                                  {status === 'intervencao' && (
                                    <>
                                      <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setMastering({ target: t, choice: 'masterizado' })}>
                                        <Award aria-hidden /> Masterizar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setMastering({ target: t, choice: 'manutencao' })}>
                                        <Wrench aria-hidden /> Mover para manutenção
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-base md:text-sm" onSelect={() => void changeStatus(t, 'fila')}>
                                        <Undo2 aria-hidden /> Voltar para a fila
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {status === 'fila' && (
                                    <DropdownMenuItem className="text-base md:text-sm" onSelect={() => void changeStatus(t, 'intervencao')}>
                                      <Play aria-hidden /> Iniciar intervenção
                                    </DropdownMenuItem>
                                  )}
                                  {status === 'manutencao' && (
                                    <>
                                      <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setMastering({ target: t, choice: 'manutencao' })}>
                                        <Wrench aria-hidden /> Mudar intervalo de revisão
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-base md:text-sm" onSelect={() => void changeStatus(t, 'masterizado')}>
                                        <Award aria-hidden /> Marcar como masterizado
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {status === 'masterizado' && (
                                    <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setMastering({ target: t, choice: 'manutencao' })}>
                                      <Wrench aria-hidden /> Mover para manutenção
                                    </DropdownMenuItem>
                                  )}
                                  {(status === 'manutencao' || status === 'masterizado') && (
                                    <DropdownMenuItem className="text-base md:text-sm" onSelect={() => void changeStatus(t, 'intervencao')}>
                                      <RotateCcw aria-hidden /> Voltar para intervenção
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-base md:text-sm"
                                    onSelect={() => {
                                      setHistoryFilter(t.id)
                                      setTab('historico')
                                    }}
                                  >
                                    <History aria-hidden /> Ver histórico
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setRenaming(t)}>
                                    <Pencil aria-hidden /> Renomear
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setRemoving(t)}>
                                    <Trash2 aria-hidden /> Remover
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </CardContent>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ),
          )}

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListPlus className="size-5" aria-hidden /> Adicionar alvos à fila
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <Textarea
                  value={newTargets}
                  onChange={(e) => setNewTargets(e.target.value)}
                  placeholder={'Ex.: Cavalo\n(cole vários, um por linha)'}
                  className="min-h-20 flex-1"
                  aria-label="Novos alvos"
                />
                <Button onClick={() => void addTargets()} disabled={!newTargets.trim() || actions.add.isPending}>
                  Adicionar
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SOBRE */}
        <TabsContent value="sobre" className="mt-4">
          <div className="grid max-w-4xl gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Procedimento</CardTitle>
              </CardHeader>
              <CardContent>
                {data.procedure ? <RichTextView text={data.procedure} /> : <p className="text-base text-muted-foreground">Nenhum procedimento descrito.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Info label="Tipo de medida">{MEASURE_LABEL[data.measure_type]}</Info>
                  <Info label="Objetivo do programa">{GOAL_LABEL[data.goal]}</Info>
                  <Info label="Protocolo de referência">{protocolText(data.protocol, data.protocol_other) ?? '—'}</Info>
                  <Info label="Área">{data.category_name ?? '—'}</Info>
                  <Info label="Critério de maestria">{masteryText(data)}</Info>
                  <Info label="Criado em">{formatDate(data.created_at)}</Info>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="mt-4">
          <HistoryList programTargets={targetIds} targetName={targetName} filter={historyFilter} onClearFilter={() => setHistoryFilter(null)} />
        </TabsContent>
      </Tabs>

      <MasterDialog
        target={mastering?.target ?? null}
        initialChoice={mastering?.choice}
        willPromote={mastering?.target.status === 'intervencao' ? nextInQueue : null}
        pending={actions.setStatus.isPending}
        onOpenChange={(o) => !o && setMastering(null)}
        onConfirm={async (choice, intervalDays) => {
          const t = mastering!.target
          try {
            const promoted = await actions.setStatus.mutateAsync({ targetId: t.id, status: choice, intervalDays })
            const promotedName = promoted ? targetName.get(promoted) : null
            toast.success(
              `“${t.name}” ${choice === 'masterizado' ? 'masterizado' : 'em manutenção'}.` + (promotedName ? ` “${promotedName}” entrou em intervenção.` : ''),
            )
            setMastering(null)
          } catch (err) {
            throw new Error(friendlyError(err))
          }
        }}
      />
      <RenameDialog
        target={renaming}
        pending={actions.rename.isPending}
        onOpenChange={(o) => !o && setRenaming(null)}
        onConfirm={async (name) => {
          try {
            await actions.rename.mutateAsync({ targetId: renaming!.id, name })
            setRenaming(null)
          } catch (err) {
            throw new Error(friendlyError(err))
          }
        }}
      />
      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{removing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              O alvo sai do programa e da coleta. Os registros já feitos com ele continuam guardados no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = removing!
                setRemoving(null)
                void run(actions.remove.mutateAsync(t.id), `“${t.name}” removido.`)
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removingProgram} onOpenChange={setRemovingProgram}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o programa “{data.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Ele some da lista e da coleta. As sessões e os registros já feitos continuam guardados. Se a ideia é só parar por um tempo, use
              “Pausado”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void removeProgram.mutateAsync(data.id).then(
                  () => {
                    toast.success('Programa removido.')
                    navigate(`/aprendizes/${learnerId}?aba=programas`)
                  },
                  (err) => toast.error(friendlyError(err)),
                )
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  )
}

function HistoryList({
  programTargets,
  targetName,
  filter,
  onClearFilter,
}: {
  programTargets: string[]
  targetName: Map<string, string>
  filter: string | null
  onClearFilter: () => void
}) {
  const history = useProgramHistory(programTargets)
  const levels = usePromptLevels()
  const team = useTeam()
  const who = new Map((team.data ?? []).map((m) => [m.id, m.full_name]))
  const events = (history.data ?? []).filter((e) => !filter || e.target_id === filter)

  if (history.isPending) return <p className="text-base text-muted-foreground">Carregando…</p>
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {filter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Só “{targetName.get(filter)}”</Badge>
          <Button variant="ghost" size="sm" onClick={onClearFilter}>
            Ver todos
          </Button>
        </div>
      )}
      {events.length === 0 ? (
        <p className="text-base text-muted-foreground">Nenhuma mudança registrada.</p>
      ) : (
        <ol className="flex flex-col divide-y rounded-xl border bg-card">
          {events.map((e) => {
            const name = targetName.get(e.target_id) ?? 'Alvo removido'
            const by = e.by ? who.get(e.by) : null
            let text: ReactNode
            if (e.kind === 'level') {
              const to = e.to ? levels.byId.get(e.to) : undefined
              const from = e.from ? levels.byId.get(e.from) : undefined
              text = from ? (
                <>
                  <strong>{name}</strong> mudou de nível: <PromptLevelBadge level={from} className="h-6" /> → <PromptLevelBadge level={to} className="h-6" />
                </>
              ) : (
                <>
                  <strong>{name}</strong> começou no nível <PromptLevelBadge level={to} className="h-6" />
                </>
              )
            } else {
              text = e.from ? (
                <>
                  <strong>{name}</strong> passou de {TARGET_STATUS_LABEL[e.from]} para {TARGET_STATUS_LABEL[e.to]}
                </>
              ) : (
                <>
                  <strong>{name}</strong> entrou no programa ({TARGET_STATUS_LABEL[e.to]})
                </>
              )
            }
            return (
              <li key={`${e.kind}-${e.id}`} className="flex flex-col gap-1 px-4 py-3">
                <p className="flex flex-wrap items-center gap-1.5 text-base">{text}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(e.at)}
                  {by ? ` · ${by}` : ''}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

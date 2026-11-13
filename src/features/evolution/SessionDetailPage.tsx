import { ArrowLeft, History, Pencil, RotateCcw, Trash2, Wrench } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/AuthProvider'
import { RATINGS, SIGNATURE_STATEMENT } from '@/features/collection/FinalizePage'
import { formatDuration, pctLabel, targetStats } from '@/features/collection/stats'
import { useLearner } from '@/features/learners/api'
import { canManageLearner } from '@/features/programs/api'
import { GOAL_LABEL } from '@/features/programs/constants'
import { PromptLevelBadge } from '@/features/programs/PromptLevelBadge'
import { usePromptLevels } from '@/features/programs/usePromptLevels'
import { useTeam } from '@/features/team/api'
import { formatDateTime, formatTime } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { useSignedUrl } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { LocalTrial } from '@/offline/db'

import { useSessionRow } from './api'
import { useSessionCorrections, useSessionDetail, type AuditRow, type DetailTrial } from './sessionDetail'

const RESULT_SIGN = { acerto: '+', dica: 'D', erro: '−' } as const
const RESULT_NAME = { acerto: '+ (independente)', dica: 'DICA', erro: '− (erro)' } as const

function Chip({ result, removed }: { result: DetailTrial['result']; removed?: boolean }) {
  if (!result) return null
  return (
    <span
      className={cn(
        'grid h-7 min-w-7 place-items-center rounded px-1 text-sm font-bold',
        result === 'acerto' && 'bg-acerto text-acerto-foreground',
        result === 'dica' && 'bg-dica text-dica-foreground',
        result === 'erro' && 'bg-erro text-erro-foreground',
        removed && 'line-through opacity-40',
      )}
    >
      {RESULT_SIGN[result]}
    </span>
  )
}

/** Trialtipo local (para reaproveitar as contas da coleta). */
const asLocal = (t: DetailTrial): LocalTrial =>
  ({ ...t, session_id: '', user_id: '', clinic_id: '', learner_id: '', program_id: '', started_at: null }) as LocalTrial

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  )
}

export function SessionDetailPage() {
  const { id: learnerId, sessionId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const learner = useLearner(learnerId)
  const session = useSessionRow(sessionId)
  const detail = useSessionDetail(sessionId)
  const levels = usePromptLevels()
  const team = useTeam()
  const corrections = useSessionCorrections(sessionId ?? '', learnerId ?? '')
  const signature = useSignedUrl('signatures', session.data?.applicator_signature_path)
  const [editing, setEditing] = useState(false)
  const [correctingTarget, setCorrectingTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const s = session.data
  const who = new Map((team.data ?? []).map((m) => [m.id, m.full_name]))
  const canCorrect = Boolean(s && s.status === 'finalizada' && canManageLearner(profile, learner.data))
  const isCoord = profile?.role === 'coordenador'

  useEffect(() => {
    if (s) document.title = `${s.number ? `Sessão #${s.number}` : 'Sessão'} · LovABA`
  }, [s])

  const back = (
    <Button asChild variant="ghost" className="mb-2 -ml-3">
      <Link to={`/aprendizes/${learnerId}?aba=sessoes`}>
        <ArrowLeft aria-hidden /> {learner.data?.full_name ?? 'Aprendiz'}
      </Link>
    </Button>
  )

  if (session.isPending || detail.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-48 w-full rounded-xl" />
      </>
    )
  }
  if (!s || !detail.data) {
    return (
      <>
        {back}
        <Card>
          <CardContent className="py-10 text-center text-base text-muted-foreground">
            {session.isError ? 'Não foi possível carregar agora. Verifique sua conexão.' : 'Sessão não encontrada, ou você não tem acesso a ela.'}
          </CardContent>
        </Card>
      </>
    )
  }

  const { trials, programs, audit } = detail.data
  const targetName = new Map(programs.flatMap((p) => p.targets.map((t) => [t.id, t.name] as const)))
  const rating = RATINGS.find((r) => r.value === s.rating)
  const tentativa = trials.filter((t) => programs.find((p) => p.targets.some((x) => x.id === t.target_id))?.measure_type === 'tentativa')
  const overall = targetStats(tentativa.map(asLocal))

  return (
    <>
      {back}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {s.number ? `Sessão #${s.number}` : 'Sessão'}
            {s.status === 'em_andamento' && <Badge variant="outline">Em andamento</Badge>}
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            {learner.data?.full_name} · {formatDateTime(s.started_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCorrect && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Corrigir notas/avaliação
            </Button>
          )}
          {isCoord && (
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden /> Excluir sessão
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Aplicador(a)">{who.get(s.applicator_id) ?? 'Profissional'}</Info>
              <Info label="Início">{formatTime(s.started_at)}</Info>
              <Info label="Fim">{s.ended_at ? formatTime(s.ended_at) : '—'}</Info>
              <Info label="Duração">{s.duration_seconds != null ? formatDuration(s.duration_seconds) : '—'}</Info>
              <Info label="Acerto independente">{overall.total ? pctLabel(overall) : '—'}</Info>
              <Info label="Avaliação">{rating ? rating.label : 'não informada'}</Info>
            </dl>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Notas da sessão (registro de evolução diária)</p>
              <p className="text-base whitespace-pre-line">{s.notes || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {s.applicator_signature_path ? (
              signature.data ? (
                <img src={signature.data} alt={`Assinatura de ${who.get(s.applicator_id) ?? 'quem aplicou'}`} className="h-28 w-full rounded-lg border bg-white object-contain" />
              ) : (
                <Skeleton className="h-28 w-full" />
              )
            ) : (
              <p className="text-base text-muted-foreground">Sem assinatura.</p>
            )}
            <p className="text-xs text-muted-foreground">{SIGNATURE_STATEMENT}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Programas e alvos</h2>
      {programs.length === 0 && <p className="text-base text-muted-foreground">Sessão sem programas (só notas).</p>}
      <div className="flex flex-col gap-4">
        {programs.map((p) => {
          const pTrials = trials.filter((t) => p.targets.some((x) => x.id === t.target_id))
          const touched = p.targets.filter((t) => pTrials.some((x) => x.target_id === t.id))
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <Link to={`/aprendizes/${learnerId}/programas/${p.id}?aba=evolucao`} className="hover:underline">
                    {p.name}
                  </Link>
                  <Badge variant="secondary">{GOAL_LABEL[p.goal]}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {touched.length === 0 ? (
                  <p className="text-base text-muted-foreground">Sem registros neste programa.</p>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {touched.map((t) => {
                      const tt = pTrials.filter((x) => x.target_id === t.id)
                      const st = targetStats(tt.map(asLocal))
                      const level = tt.find((x) => x.prompt_level_id)?.prompt_level_id
                      const helps = new Map<string, number>()
                      for (const x of tt) if (!x.deleted_at && x.result === 'dica' && x.help_level_id) helps.set(x.help_level_id, (helps.get(x.help_level_id) ?? 0) + 1)
                      return (
                        <li key={t.id} className="flex flex-col gap-2 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-base font-medium">
                              {p.measure_type === 'tentativa' && level && <PromptLevelBadge level={levels.byId.get(level)} className="h-6" />}
                              {t.name}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-base font-semibold tabular-nums">
                                {p.measure_type === 'tentativa'
                                  ? pctLabel(st)
                                  : p.measure_type === 'frequencia'
                                    ? `${st.occurrences} ${st.occurrences === 1 ? 'ocorrência' : 'ocorrências'}`
                                    : `${formatDuration(st.seconds)} (${st.occurrences}×)`}
                              </span>
                              {canCorrect && (
                                <Button size="sm" variant="ghost" onClick={() => setCorrectingTarget(t)}>
                                  <Wrench aria-hidden /> Corrigir
                                </Button>
                              )}
                            </span>
                          </div>
                          {p.measure_type === 'tentativa' && (
                            <div className="flex flex-wrap gap-1" aria-label={`Tentativas de ${t.name}`}>
                              {tt.map((x) => (
                                <Chip key={x.id} result={x.result} removed={Boolean(x.deleted_at)} />
                              ))}
                            </div>
                          )}
                          {helps.size > 0 && (
                            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                              Ajuda usada nas DICAs:
                              {[...helps.entries()].map(([lid, n]) => (
                                <span key={lid} className="inline-flex items-center gap-1">
                                  <PromptLevelBadge level={levels.byId.get(lid)} className="h-5 px-1.5 text-xs" /> {n}
                                </span>
                              ))}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <h2 className="mt-8 mb-3 flex items-center gap-2 text-xl font-semibold">
        <History className="size-5" aria-hidden /> Correções
      </h2>
      {audit.length === 0 ? (
        <p className="text-base text-muted-foreground">Nenhuma correção depois de finalizada.</p>
      ) : (
        <ol className="flex flex-col divide-y rounded-xl border bg-card">
          {audit.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3">
              <p className="text-base">{describeAudit(a, targetName, levels.byId)}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(a.changed_at)} · {a.changed_by ? (who.get(a.changed_by) ?? 'Profissional') : 'Sistema'}
              </p>
            </li>
          ))}
        </ol>
      )}

      <EditSessionDialog
        open={editing}
        onOpenChange={setEditing}
        notes={s.notes ?? ''}
        rating={s.rating}
        pending={corrections.updateSession.isPending}
        onSave={async (notes, newRating) => {
          try {
            await corrections.updateSession.mutateAsync({ notes: notes.trim() || null, rating: newRating })
            toast.success('Sessão corrigida. A mudança ficou registrada.')
            setEditing(false)
          } catch (err) {
            toast.error(friendlyError(err))
          }
        }}
      />

      <CorrectTrialsDialog
        target={correctingTarget}
        trials={correctingTarget ? trials.filter((t) => t.target_id === correctingTarget.id) : []}
        onOpenChange={(o) => !o && setCorrectingTarget(null)}
        onChange={async (trial, change) => {
          try {
            await corrections.updateTrial.mutateAsync({ trial, ...change })
            toast.success('Correção registrada.')
          } catch (err) {
            toast.error(friendlyError(err))
          }
        }}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta sessão?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Ela sai das listas e dos gráficos. Os dados continuam guardados (exclusão lógica) e a ação fica registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void corrections.updateSession.mutateAsync({ deleted_at: new Date().toISOString() }).then(
                  () => {
                    toast.success('Sessão excluída.')
                    navigate(`/aprendizes/${learnerId}?aba=sessoes`)
                  },
                  (err) => toast.error(friendlyError(err)),
                )
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Texto simples para cada linha da auditoria. */
function describeAudit(a: AuditRow, targetName: Map<string, string>, levels: Map<string, { abbreviation: string }>): string {
  const o = a.old_data ?? {}
  const n = a.new_data ?? {}
  if (a.table_name === 'trials') {
    const name = targetName.get(String(n.target_id ?? o.target_id)) ?? 'alvo'
    if (a.action === 'INSERT') return `Tentativa adicionada em “${name}”`
    if (!o.deleted_at && n.deleted_at) return `Tentativa removida em “${name}”`
    if (o.deleted_at && !n.deleted_at) return `Tentativa restaurada em “${name}”`
    if (o.result !== n.result) {
      const sign = (r: unknown) => (r ? RESULT_SIGN[r as keyof typeof RESULT_SIGN] : '—')
      return `Tentativa em “${name}”: ${sign(o.result)} → ${sign(n.result)}`
    }
    if (o.help_level_id !== n.help_level_id) return `Ajuda usada em “${name}” alterada para ${levels.get(String(n.help_level_id))?.abbreviation ?? '—'}`
    return `Tentativa em “${name}” alterada`
  }
  if (a.table_name === 'sessions') {
    const parts: string[] = []
    if (!o.deleted_at && n.deleted_at) parts.push('Sessão excluída')
    if (o.notes !== n.notes) parts.push('Notas alteradas')
    if (o.rating !== n.rating) {
      const label = (r: unknown) => RATINGS.find((x) => x.value === r)?.label ?? 'sem avaliação'
      parts.push(`Avaliação: ${label(o.rating)} → ${label(n.rating)}`)
    }
    if (o.supervisor_signature_path !== n.supervisor_signature_path) parts.push('Assinatura do responsável técnico')
    return parts.join(' · ') || 'Dados da sessão alterados'
  }
  return 'Programas da sessão alterados'
}

function EditSessionDialog({
  open,
  onOpenChange,
  notes,
  rating,
  pending,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  notes: string
  rating: number | null
  pending: boolean
  onSave: (notes: string, rating: number | null) => Promise<void>
}) {
  const [text, setText] = useState(notes)
  const [value, setValue] = useState(rating)
  useEffect(() => {
    if (open) {
      setText(notes)
      setValue(rating)
    }
  }, [open, notes, rating])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corrigir sessão</DialogTitle>
          <DialogDescription>A sessão já foi finalizada: a correção fica registrada (quem, quando e o que mudou).</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Avaliação">
            {RATINGS.map(({ value: v, label, Icon }) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={value === v}
                onClick={() => setValue(v)}
                className={cn('flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs', value === v && 'border-2 border-primary bg-primary/10')}
              >
                <Icon className={cn('size-6', value === v ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fix-notes">Notas</Label>
            <Textarea id="fix-notes" value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSave(text, value)} disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar correção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CorrectTrialsDialog({
  target,
  trials,
  onOpenChange,
  onChange,
}: {
  target: { id: string; name: string } | null
  trials: DetailTrial[]
  onOpenChange: (o: boolean) => void
  onChange: (trial: DetailTrial, change: { result?: 'acerto' | 'erro' | 'dica'; remove?: boolean; restore?: boolean }) => Promise<void>
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corrigir “{target?.name}”</DialogTitle>
          <DialogDescription>Cada correção fica registrada na auditoria da sessão.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col divide-y">
          {trials.map((t, i) => (
            <li key={t.id} className={cn('flex flex-wrap items-center gap-2 py-2', t.deleted_at && 'opacity-60')}>
              <span className="w-16 text-sm text-muted-foreground">
                {i + 1}ª · {formatTime(t.recorded_at)}
              </span>
              {t.result ? (
                <div className="flex gap-1" role="radiogroup" aria-label={`Resultado da tentativa ${i + 1}`}>
                  {(['erro', 'dica', 'acerto'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={t.result === r}
                      aria-label={RESULT_NAME[r]}
                      disabled={Boolean(t.deleted_at)}
                      onClick={() => t.result !== r && void onChange(t, { result: r })}
                      className={cn('rounded-md p-0.5', t.result === r ? 'ring-2 ring-foreground' : 'opacity-50 hover:opacity-100')}
                    >
                      <Chip result={r} />
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-sm">{t.value != null ? (t.value === 1 ? '1 ocorrência' : formatDuration(t.value)) : '—'}</span>
              )}
              <span className="ml-auto">
                {t.deleted_at ? (
                  <Button size="sm" variant="ghost" onClick={() => void onChange(t, { restore: true })}>
                    <RotateCcw aria-hidden /> Restaurar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void onChange(t, { remove: true })}>
                    <Trash2 aria-hidden /> Remover
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Pronto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { CheckCheck, NotebookPen, Timer, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router'
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { FullScreenLoader } from '@/features/auth/RequireAuth'
import { GOAL_LABEL } from '@/features/programs/constants'
import { PromptLevelBadge } from '@/features/programs/PromptLevelBadge'
import { cn } from '@/lib/utils'
import { ops } from '@/offline'
import type { LocalSession, LocalTrial, SnapshotProgram, SnapshotTarget } from '@/offline/db'
import { useLocalSession, useSessionTrials } from '@/offline/hooks'
import { SyncIndicator } from '@/offline/SyncIndicator'

import { formatClock } from './stats'
import { TargetCard } from './TargetCard'
import { useBeforeUnload, useNow, useWakeLock, vibrate } from './useDevice'

const RESULT_LABEL = { acerto: '+', erro: '−', dica: 'DICA' } as const

/** Passo 4: coleta. Cada toque é salvo no aparelho na hora. */
export function CollectPage() {
  const { sessionId } = useParams()
  const session = useLocalSession(sessionId)
  if (session === undefined) return <FullScreenLoader />
  if (!session) return <Navigate to="/" replace />
  if (session.status === 'finalizada') return <Navigate to={`/sessao/${session.id}/resumo`} replace />
  return <Collect session={session} />
}

function Collect({ session }: { session: LocalSession }) {
  const navigate = useNavigate()
  const trials = useSessionTrials(session.id)
  const now = useNow(1000)
  const [dica, setDica] = useState<{ program: SnapshotProgram; target: SnapshotTarget } | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const leavingToFinalize = useRef(false)

  useWakeLock(true)
  useBeforeUnload(true)
  useEffect(() => {
    document.title = `Coleta · ${session.learner_initials || 'sessão'} · LovABA`
  }, [session.learner_initials])

  // Avisa antes de sair da coleta com a sessão em andamento
  const blocker = useBlocker(({ nextLocation }) => !leavingToFinalize.current && !nextLocation.pathname.startsWith(`/sessao/${session.id}`))

  const levelById = useMemo(() => new Map(session.levels.map((l) => [l.id, l])), [session.levels])
  const byTarget = useMemo(() => {
    const m = new Map<string, LocalTrial[]>()
    for (const t of trials) {
      const list = m.get(t.target_id)
      if (list) list.push(t)
      else m.set(t.target_id, [t])
    }
    return m
  }, [trials])

  const active = trials.filter((t) => !t.deleted_at)
  const totalTargets = session.programs.reduce((n, p) => n + p.targets.length, 0)
  const touchedTargets = session.programs.reduce((n, p) => n + p.targets.filter((t) => (byTarget.get(t.id) ?? []).some((x) => !x.deleted_at)).length, 0)
  const progress = totalTargets ? Math.round((touchedTargets / totalTargets) * 100) : 0
  const elapsed = (now - new Date(session.started_at).getTime()) / 1000

  const record = useCallback(
    async (program: SnapshotProgram, target: SnapshotTarget, input: { result?: 'acerto' | 'erro' | 'dica'; help_level_id?: string | null; value?: number }) => {
      vibrate()
      try {
        await ops.recordTrial({ session, program_id: program.id, target_id: target.id, ...input })
      } catch {
        toast.error('Não foi possível salvar este toque. Tente de novo.')
      }
    },
    [session],
  )

  async function undoLast() {
    vibrate([10, 40, 10])
    const undone = await ops.undoLast(session.id)
    if (!undone) return
    const target = session.programs.flatMap((p) => p.targets).find((t) => t.id === undone.target_id)
    const what = undone.result ? RESULT_LABEL[undone.result] : 'registro'
    toast(`Desfeito: ${what} em “${target?.name ?? 'alvo'}”`, { duration: 2000 })
  }

  const lastActive = active[active.length - 1]

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Topo fixo */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{session.learner_initials || session.learner_name}</p>
              <p className="flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Timer className="size-4" aria-hidden /> {formatClock(elapsed)}
                </span>
                <span>
                  {active.length} {active.length === 1 ? 'registro' : 'registros'}
                </span>
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setNotesOpen(true)} aria-label="Notas da sessão" title="Notas da sessão">
              <NotebookPen aria-hidden />
            </Button>
            <Button
              onClick={() => {
                leavingToFinalize.current = true
                navigate(`/sessao/${session.id}/finalizar`)
              }}
            >
              <CheckCheck aria-hidden /> Finalizar
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Alvos com registro"
            >
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <SyncIndicator className="shrink-0 text-xs" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-3 pt-4 pb-32">
        {session.programs.length === 0 && (
          <div className="rounded-xl border bg-card p-4 text-base">
            Sessão sem programas: use o botão de notas para o registro de evolução e depois finalize.
          </div>
        )}
        {session.programs.map((p) => (
          <section key={p.id} aria-labelledby={`p-${p.id}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`p-${p.id}`} className="text-lg font-semibold">
                {p.name}
              </h2>
              <Badge variant="secondary">{GOAL_LABEL[p.goal]}</Badge>
            </div>
            {p.targets.length === 0 && <p className="text-base text-muted-foreground">Sem alvos para coletar.</p>}
            {p.targets.map((t) => (
              <TargetCard
                key={t.id}
                program={p}
                target={t}
                level={t.level_id ? levelById.get(t.level_id) : undefined}
                trials={byTarget.get(t.id) ?? []}
                runningSince={session.running[t.id]}
                now={now}
                actions={{
                  onResult: (r) => void record(p, t, { result: r }),
                  onDica: () => setDica({ program: p, target: t }),
                  onCount: () => void record(p, t, { value: 1 }),
                  onUndo: () => {
                    vibrate([10, 40, 10])
                    void ops.undoLast(session.id, t.id)
                  },
                  onStartTimer: () => {
                    vibrate()
                    void ops.startTimer(session.id, t.id)
                  },
                  onStopTimer: () => {
                    vibrate()
                    void ops.stopTimer(session.id, p.id, t.id)
                  },
                }}
              />
            ))}
          </section>
        ))}
      </main>

      {/* Desfazer sempre visível */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button variant="outline" size="lg" className="h-14 flex-1 text-base" onClick={() => void undoLast()} disabled={!lastActive}>
            <Undo2 className="size-5" aria-hidden /> Desfazer última marcação
          </Button>
        </div>
      </div>

      <DicaSheet
        open={Boolean(dica)}
        target={dica?.target}
        levels={session.levels}
        onClose={() => setDica(null)}
        onConfirm={(levelId) => {
          if (dica) void record(dica.program, dica.target, { result: 'dica', help_level_id: levelId })
          setDica(null)
        }}
      />
      <NotesSheet open={notesOpen} onOpenChange={setNotesOpen} session={session} />

      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da coleta?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              A sessão continua em andamento e tudo já está salvo no aparelho. Você pode voltar e continuar depois, mas lembre de finalizar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.state === 'blocked' && blocker.reset()}>Continuar coletando</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.state === 'blocked' && blocker.proceed()}>Sair por enquanto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Toque em DICA: escolher a ajuda usada (o nível atual já vem marcado; um toque confirma). */
function DicaSheet({
  open,
  target,
  levels,
  onClose,
  onConfirm,
}: {
  open: boolean
  target: SnapshotTarget | undefined
  levels: LocalSession['levels']
  onClose: () => void
  onConfirm: (levelId: string | null) => void
}) {
  const helpLevels = levels.filter((l) => !l.is_independent)
  const current = helpLevels.find((l) => l.id === target?.level_id)
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="text-lg">Qual ajuda foi usada?</SheetTitle>
          <SheetDescription className="text-base">{target?.name}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <button
            type="button"
            onClick={() => onConfirm(current?.id ?? target?.level_id ?? null)}
            className="flex h-16 items-center justify-center gap-3 rounded-xl bg-dica text-lg font-bold text-dica-foreground shadow-sm active:scale-95"
          >
            Confirmar {current ? <PromptLevelBadge level={current} /> : 'DICA'}
          </button>
          {helpLevels.length > 0 && <p className="pt-2 text-sm text-muted-foreground">Ou toque na ajuda que foi usada:</p>}
          <div className="grid grid-cols-2 gap-2">
            {helpLevels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onConfirm(l.id)}
                className={cn(
                  'flex min-h-14 items-center gap-2 rounded-xl border bg-card px-3 text-left text-base active:scale-95',
                  l.id === current?.id && 'border-2 border-foreground',
                )}
              >
                <PromptLevelBadge level={l} />
                <span className="text-sm leading-tight">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Notas da sessão ("registro de evolução diária"), salvas no aparelho enquanto digita. */
function NotesSheet({ open, onOpenChange, session }: { open: boolean; onOpenChange: (o: boolean) => void; session: LocalSession }) {
  const [text, setText] = useState(session.notes)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) setText(session.notes)
  }, [open])

  function change(v: string) {
    setText(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void ops.updateSession(session.id, { notes: v }), 500)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (timer.current) clearTimeout(timer.current)
          if (text !== session.notes) void ops.updateSession(session.id, { notes: text })
        }
        onOpenChange(o)
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="text-lg">Notas da sessão</SheetTitle>
          <SheetDescription className="text-base">Registro de evolução diária. Dá para usar o microfone do teclado para ditar.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <Textarea value={text} onChange={(e) => change(e.target.value)} className="min-h-48 text-base" autoFocus aria-label="Notas da sessão" />
          <Button size="lg" onClick={() => onOpenChange(false)}>
            Pronto
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}


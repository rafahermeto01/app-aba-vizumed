import { Pause, Play, Plus, Undo2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PromptLevelBadge } from '@/features/programs/PromptLevelBadge'
import { cn } from '@/lib/utils'
import type { LocalTrial, SnapshotLevel, SnapshotProgram, SnapshotTarget } from '@/offline/db'

import { formatClock, formatDuration, pctLabel, targetStats } from './stats'

export type TargetActions = {
  onResult: (result: 'acerto' | 'erro') => void
  onDica: () => void
  onCount: () => void
  onUndo: () => void
  onStartTimer: () => void
  onStopTimer: () => void
}

function Sequence({ seq }: { seq: ('+' | 'D' | '−')[] }) {
  if (!seq.length) return <span className="text-sm text-muted-foreground">Nenhuma tentativa ainda</span>
  const shown = seq.slice(-24)
  return (
    <span className="flex flex-wrap gap-1" aria-label={`Tentativas: ${seq.join(' ')}`}>
      {seq.length > shown.length && <span className="text-sm text-muted-foreground">…</span>}
      {shown.map((s, i) => (
        <span
          key={i}
          className={cn(
            'grid h-6 min-w-6 place-items-center rounded px-1 text-sm font-bold',
            s === '+' && 'bg-acerto text-acerto-foreground',
            s === 'D' && 'bg-dica text-dica-foreground',
            s === '−' && 'bg-erro text-erro-foreground',
          )}
        >
          {s}
        </span>
      ))}
    </span>
  )
}

/** Card de um alvo durante a coleta (um toque = um registro). */
export function TargetCard({
  program,
  target,
  level,
  trials,
  runningSince,
  now,
  actions,
}: {
  program: SnapshotProgram
  target: SnapshotTarget
  level: SnapshotLevel | undefined
  trials: LocalTrial[]
  runningSince: string | undefined
  now: number
  actions: TargetActions
}) {
  const st = targetStats(trials)
  const hasAny = trials.some((t) => !t.deleted_at)

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{target.name}</h3>
          {program.measure_type === 'tentativa' && <PromptLevelBadge level={level} />}
          <Badge variant={target.phase === 'manutencao' ? 'outline' : 'secondary'}>{target.phase === 'manutencao' ? 'Manutenção' : 'Intervenção'}</Badge>
        </div>

        {program.measure_type === 'tentativa' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => actions.onResult('erro')}
                className="h-16 rounded-xl bg-erro text-3xl font-bold text-erro-foreground shadow-sm active:scale-95"
                aria-label={`− Erro em ${target.name}`}
              >
                −
              </button>
              <button
                type="button"
                onClick={actions.onDica}
                className="h-16 rounded-xl bg-dica text-xl font-bold text-dica-foreground shadow-sm active:scale-95"
                aria-label={`DICA: acerto com dica em ${target.name}`}
              >
                DICA
              </button>
              <button
                type="button"
                onClick={() => actions.onResult('acerto')}
                className="h-16 rounded-xl bg-acerto text-3xl font-bold text-acerto-foreground shadow-sm active:scale-95"
                aria-label={`+ Acerto independente em ${target.name}`}
              >
                +
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Sequence seq={st.sequence} />
              <span className="shrink-0 text-base font-semibold tabular-nums" aria-label="Acerto independente nesta sessão">
                {pctLabel(st)}
              </span>
            </div>
          </>
        )}

        {program.measure_type === 'frequencia' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={actions.onCount}
              className="flex h-16 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-2xl font-bold text-primary-foreground shadow-sm active:scale-95"
              aria-label={`+1: mais uma ocorrência de ${target.name}`}
            >
              <Plus className="size-7" aria-hidden /> 1
            </button>
            <div className="w-24 text-center">
              <p className="text-3xl font-bold tabular-nums">{st.occurrences}</p>
              <p className="text-sm text-muted-foreground">{st.occurrences === 1 ? 'ocorrência' : 'ocorrências'}</p>
            </div>
          </div>
        )}

        {program.measure_type === 'duracao' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={runningSince ? actions.onStopTimer : actions.onStartTimer}
              className={cn(
                'flex h-16 items-center justify-center gap-2 rounded-xl text-xl font-bold shadow-sm active:scale-95',
                runningSince ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground',
              )}
              aria-label={runningSince ? `Parar cronômetro de ${target.name}` : `Iniciar cronômetro de ${target.name}`}
            >
              {runningSince ? <Pause className="size-6" aria-hidden /> : <Play className="size-6" aria-hidden />}
              {runningSince ? `Parar · ${formatClock((now - new Date(runningSince).getTime()) / 1000)}` : 'Iniciar'}
            </button>
            <p className="text-sm text-muted-foreground">
              {st.occurrences
                ? `${st.occurrences} ${st.occurrences === 1 ? 'vez' : 'vezes'} · total ${formatDuration(st.seconds)} · ${trials
                    .filter((t) => !t.deleted_at && t.value != null)
                    .map((t) => formatDuration(t.value!))
                    .join(', ')}`
                : 'Nenhuma duração registrada ainda'}
            </p>
          </div>
        )}

        {program.measure_type !== 'tentativa' && (
          <Button variant="ghost" size="sm" className="self-start" onClick={actions.onUndo} disabled={!hasAny}>
            <Undo2 aria-hidden /> Desfazer último
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

import { Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FormError } from '@/features/auth/AuthCard'
import { cn } from '@/lib/utils'

import type { Target } from './api'
import { PromptLevelBadge } from './PromptLevelBadge'
import type { PromptLevel } from './usePromptLevels'

/** Toque na etiqueta do nível → lista de níveis → um toque muda. */
export function LevelPicker({
  current,
  levels,
  onPick,
  disabled,
  targetName,
}: {
  current: PromptLevel | undefined
  levels: PromptLevel[]
  onPick: (levelId: string) => void
  disabled?: boolean
  targetName: string
}) {
  const [open, setOpen] = useState(false)
  if (disabled) return <PromptLevelBadge level={current} />
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`Nível de ajuda de ${targetName}: ${current?.name ?? 'sem nível'}. Toque para mudar.`}
        >
          <PromptLevelBadge level={current} className="h-9 px-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <p className="px-2 pb-2 text-sm text-muted-foreground">Mudar nível de ajuda (vale a partir da próxima sessão)</p>
        <ul className="flex flex-col gap-1">
          {levels.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (l.id !== current?.id) onPick(l.id)
                }}
                className={cn('flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-base hover:bg-muted', l.id === current?.id && 'bg-muted')}
              >
                <PromptLevelBadge level={l} className="w-14 justify-center" />
                <span className="flex-1">{l.name}</span>
                {l.id === current?.id && <Check className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Masterizar: vai para "Masterizados" ou para "Manutenção" (com revisão periódica). */
export function MasterDialog({
  target,
  initialChoice = 'masterizado',
  onOpenChange,
  onConfirm,
  pending,
  willPromote,
}: {
  target: Target | null
  initialChoice?: 'masterizado' | 'manutencao'
  onOpenChange: (o: boolean) => void
  onConfirm: (choice: 'masterizado' | 'manutencao', intervalDays?: number) => Promise<void>
  pending: boolean
  willPromote: string | null
}) {
  const [choice, setChoice] = useState<'masterizado' | 'manutencao'>(initialChoice)
  const [days, setDays] = useState('7')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (target) {
      setChoice(initialChoice)
      setDays(String(target.maintenance_interval_days ?? 7))
      setError(null)
    }
  }, [target, initialChoice])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = Number(days)
    if (choice === 'manutencao' && (!Number.isInteger(n) || n < 1 || n > 365)) return setError('Informe um intervalo entre 1 e 365 dias.')
    try {
      await onConfirm(choice, choice === 'manutencao' ? n : undefined)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const fromIntervention = target?.status === 'intervencao'
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fromIntervention ? `Masterizar “${target?.name}”` : `“${target?.name}”`}</DialogTitle>
          <DialogDescription>Para onde vai o alvo?</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Destino do alvo">
            {(
              [
                ['masterizado', 'Masterizados', 'Concluído. Não aparece mais na coleta.'],
                ['manutencao', 'Manutenção', 'Volta para a coleta de tempos em tempos, para revisão.'],
              ] as const
            ).map(([value, title, desc]) => (
              <label key={value} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', choice === value && 'border-primary bg-primary/5')}>
                <input type="radio" name="master-choice" checked={choice === value} onChange={() => setChoice(value)} className="mt-1 size-5 accent-primary" />
                <span>
                  <span className="block text-base font-medium">{title}</span>
                  <span className="block text-sm text-muted-foreground">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          {choice === 'manutencao' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="mt-days">Revisar a cada quantos dias?</Label>
              <Input id="mt-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} className="w-32" />
            </div>
          )}
          {fromIntervention && (
            <p className="rounded-xl bg-muted/50 p-3 text-base">
              {willPromote ? (
                <>
                  O próximo da fila, <strong>“{willPromote}”</strong>, entra em intervenção automaticamente.
                </>
              ) : (
                'Não há alvos na fila para entrar no lugar.'
              )}
            </p>
          )}
          <FormError message={error} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RenameDialog({
  target,
  onOpenChange,
  onConfirm,
  pending,
}: {
  target: Target | null
  onOpenChange: (o: boolean) => void
  onConfirm: (name: string) => Promise<void>
  pending: boolean
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (target) {
      setName(target.name)
      setError(null)
    }
  }, [target])
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear alvo</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return setError('Informe o nome do alvo.')
            onConfirm(name).catch((err: Error) => setError(err.message))
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do alvo" autoFocus />
          <FormError message={error} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

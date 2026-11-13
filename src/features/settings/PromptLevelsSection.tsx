import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FormError } from '@/features/auth/AuthCard'
import { LEVEL_PALETTE, readableTextColor } from '@/features/programs/constants'
import { usePromptLevels, type PromptLevel } from '@/features/programs/usePromptLevels'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Draft = { key: string; id?: string; name: string; abbreviation: string; color: string; is_independent: boolean }

const toDraft = (l: PromptLevel): Draft => ({
  key: l.id,
  id: l.id,
  name: l.name,
  abbreviation: l.abbreviation,
  color: l.color,
  is_independent: l.is_independent,
})

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-background shadow-sm ring-1 ring-border"
          style={{ backgroundColor: value }}
          aria-label={`Cor de ${label}`}
          title="Escolher cor"
        />
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <p className="mb-2 text-sm text-muted-foreground">Verde, amarelo e vermelho ficam reservados para acerto, dica e erro.</p>
        <div className="grid grid-cols-5 gap-2">
          {LEVEL_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className="grid size-10 place-items-center rounded-lg"
              style={{ backgroundColor: c, color: readableTextColor(c) }}
              aria-label={`Cor ${c}`}
            >
              {value.toLowerCase() === c && <Check className="size-5" aria-hidden />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LevelsEditor({ initial }: { initial: PromptLevel[] }) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<Draft[]>(() => initial.map(toDraft))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const change = (next: Draft[]) => {
    setItems(next)
    setDirty(true)
  }
  const update = (key: string, patch: Partial<Draft>) => change(items.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const move = (index: number, delta: number) => {
    const next = [...items]
    const [it] = next.splice(index, 1)
    next.splice(index + delta, 0, it)
    change(next)
  }

  async function save() {
    setError(null)
    if (items.some((i) => !i.name.trim() || !i.abbreviation.trim())) return setError('Preencha o nome e a sigla de todos os níveis.')
    setSaving(true)
    try {
      const { error: err } = await supabase.rpc('save_prompt_levels', {
        p: items.map(({ id, name, abbreviation, color, is_independent }) => ({ id, name, abbreviation, color, is_independent })),
      })
      if (err) throw err
      await queryClient.invalidateQueries({ queryKey: ['prompt-levels'] })
      setDirty(false)
      toast.success('Níveis de ajuda salvos.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Níveis de ajuda</CardTitle>
          <CardDescription className="text-base">
            Do topo (maior ajuda) para baixo (independência). Use as setas para mudar a ordem. Alterar aqui vale para toda a clínica; o
            histórico dos alvos continua com a sigla que estava valendo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {items.map((it, i) => (
              <li key={it.key} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-end">
                <div className="flex items-center gap-2 sm:flex-col sm:gap-1">
                  <span className="w-6 text-center text-sm font-medium text-muted-foreground">{i + 1}º</span>
                  <div className="flex gap-1 sm:flex-col">
                    <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${it.abbreviation}`}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${it.abbreviation}`}>
                      <ArrowDown aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-[auto_1fr] gap-3 sm:grid-cols-[auto_6rem_1fr]">
                  <div className="flex flex-col gap-2">
                    <Label>Cor</Label>
                    <ColorPicker value={it.color} onChange={(c) => update(it.key, { color: c })} label={it.abbreviation || 'nível'} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`lv-abbr-${it.key}`}>Sigla</Label>
                    <Input
                      id={`lv-abbr-${it.key}`}
                      value={it.abbreviation}
                      maxLength={6}
                      onChange={(e) => update(it.key, { abbreviation: e.target.value.toUpperCase() })}
                      className="font-semibold"
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
                    <Label htmlFor={`lv-name-${it.key}`}>Nome</Label>
                    <Input id={`lv-name-${it.key}`} value={it.name} onChange={(e) => update(it.key, { name: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="independent"
                      checked={it.is_independent}
                      onChange={() => change(items.map((x) => ({ ...x, is_independent: x.key === it.key })))}
                      className="size-5 accent-primary"
                    />
                    Independente
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => change(items.filter((x) => x.key !== it.key))}
                    disabled={items.length <= 2}
                    aria-label={`Remover ${it.abbreviation}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() =>
              change([
                ...items,
                { key: crypto.randomUUID(), name: '', abbreviation: '', color: LEVEL_PALETTE[items.length % LEVEL_PALETTE.length], is_independent: false },
              ])
            }
          >
            <Plus aria-hidden /> Adicionar nível
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como vai aparecer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {items.map((it) => (
            <span
              key={it.key}
              className={cn('inline-flex h-8 items-center rounded-md px-2.5 text-sm font-semibold')}
              style={{ backgroundColor: it.color, color: readableTextColor(it.color) }}
              title={it.name}
            >
              {it.abbreviation || '—'}
            </span>
          ))}
        </CardContent>
      </Card>

      <FormError message={error} />
      <div className="flex gap-3">
        <Button size="lg" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? 'Salvando…' : 'Salvar níveis'}
        </Button>
        {dirty && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              setItems(initial.map(toDraft))
              setDirty(false)
              setError(null)
            }}
          >
            Desfazer alterações
          </Button>
        )}
      </div>
    </div>
  )
}

export function PromptLevelsSection() {
  const levels = usePromptLevels()
  if (levels.isPending) return <p className="text-base text-muted-foreground">Carregando…</p>
  if (levels.isError) return <p className="text-base text-muted-foreground">Não foi possível carregar os níveis de ajuda.</p>
  return <LevelsEditor key={levels.active.map((l) => l.id + l.sort_order + l.name + l.color).join()} initial={levels.active} />
}

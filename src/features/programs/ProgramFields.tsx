import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { RichTextEditor } from '@/components/RichText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { GOAL_LABEL, masteryText, MEASURE_LABEL, PROTOCOL_LABEL, type MeasureType, type ProgramGoal, type Protocol } from './constants'

/** Campos comuns entre modelo da biblioteca e programa do aprendiz. */
export type ProgramDescription = {
  name: string
  objective: string
  procedure: string
  measure_type: MeasureType
  goal: ProgramGoal
  protocol: Protocol | ''
  protocol_other: string
}

export type Mastery = { mastery_min_pct: number; mastery_sessions: number; mastery_min_trials: number }

export const emptyDescription = (): ProgramDescription => ({
  name: '',
  objective: '',
  procedure: '',
  measure_type: 'tentativa',
  goal: 'aquisicao',
  protocol: '',
  protocol_other: '',
})

export function FieldRow({ id, label, hint, error, children }: { id?: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function DescriptionFields({
  value,
  onChange,
  nameError,
  lockMeasure = false,
  extra,
}: {
  value: ProgramDescription
  onChange: (v: ProgramDescription) => void
  nameError?: string
  /** Depois de ter sessões, o tipo de medida não muda (o histórico ficaria sem sentido). */
  lockMeasure?: boolean
  extra?: ReactNode
}) {
  const set = <K extends keyof ProgramDescription>(k: K, v: ProgramDescription[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="flex flex-col gap-5">
      <FieldRow id="pf-name" label="Nome do programa" error={nameError}>
        <Input id="pf-name" value={value.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(nameError) || undefined} autoComplete="off" />
      </FieldRow>
      <FieldRow id="pf-objective" label="Objetivo" hint={`${value.objective.length}/500 caracteres`}>
        <Textarea id="pf-objective" value={value.objective} maxLength={500} onChange={(e) => set('objective', e.target.value)} className="min-h-20" />
      </FieldRow>
      <FieldRow id="pf-procedure" label="Procedimento" hint="Como aplicar: instrução, materiais, correção de erro, reforço.">
        <RichTextEditor id="pf-procedure" value={value.procedure} onChange={(v) => set('procedure', v)} />
      </FieldRow>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldRow id="pf-measure" label="Tipo de medida" hint={lockMeasure ? 'Não muda depois que o programa já tem sessões.' : undefined}>
          <Select value={value.measure_type} onValueChange={(v) => set('measure_type', v as MeasureType)} disabled={lockMeasure}>
            <SelectTrigger id="pf-measure" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MEASURE_LABEL) as MeasureType[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {MEASURE_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow id="pf-goal" label="Objetivo do programa">
          <Select value={value.goal} onValueChange={(v) => set('goal', v as ProgramGoal)}>
            <SelectTrigger id="pf-goal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aquisicao">{GOAL_LABEL.aquisicao} (ensinar uma habilidade)</SelectItem>
              <SelectItem value="reducao">{GOAL_LABEL.reducao} (diminuir um comportamento)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow id="pf-protocol" label="Protocolo de referência (opcional)">
          <Select value={value.protocol || 'nenhum'} onValueChange={(v) => set('protocol', v === 'nenhum' ? '' : (v as Protocol))}>
            <SelectTrigger id="pf-protocol" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Nenhum</SelectItem>
              {(Object.keys(PROTOCOL_LABEL) as Protocol[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PROTOCOL_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        {value.protocol === 'outro' && (
          <FieldRow id="pf-protocol-other" label="Qual protocolo?">
            <Input id="pf-protocol-other" value={value.protocol_other} onChange={(e) => set('protocol_other', e.target.value)} autoComplete="off" />
          </FieldRow>
        )}
        {extra}
      </div>
    </div>
  )
}

export function MasteryFields({ value, onChange, measure, goal }: { value: Mastery; onChange: (v: Mastery) => void; measure: MeasureType; goal: ProgramGoal }) {
  const set = (k: keyof Mastery, raw: string) => {
    const n = Number(raw.replace(/\D/g, ''))
    onChange({ ...value, [k]: Number.isFinite(n) ? n : 0 })
  }
  const applies = measure === 'tentativa' && goal === 'aquisicao'
  return (
    <div className="flex flex-col gap-4">
      {!applies && (
        <p className="rounded-xl border bg-muted/40 p-3 text-base">
          A sugestão automática de maestria vale para programas de <strong>aquisição</strong> do tipo <strong>Tentativa</strong>. Para os
          outros, a supervisão decide olhando o gráfico.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldRow id="pm-pct" label="% mínima de acerto independente">
          <Input id="pm-pct" inputMode="numeric" value={String(value.mastery_min_pct)} onChange={(e) => set('mastery_min_pct', e.target.value)} />
        </FieldRow>
        <FieldRow id="pm-sessions" label="Sessões consecutivas">
          <Input id="pm-sessions" inputMode="numeric" value={String(value.mastery_sessions)} onChange={(e) => set('mastery_sessions', e.target.value)} />
        </FieldRow>
        <FieldRow id="pm-trials" label="Mínimo de tentativas por sessão">
          <Input id="pm-trials" inputMode="numeric" value={String(value.mastery_min_trials)} onChange={(e) => set('mastery_min_trials', e.target.value)} />
        </FieldRow>
      </div>
      <p className="text-base text-muted-foreground">Critério: {masteryText(value)}.</p>
    </div>
  )
}

export function masteryError(m: Mastery): string | null {
  if (m.mastery_min_pct < 1 || m.mastery_min_pct > 100) return 'A % mínima precisa estar entre 1 e 100.'
  if (m.mastery_sessions < 1 || m.mastery_sessions > 20) return 'O número de sessões precisa estar entre 1 e 20.'
  if (m.mastery_min_trials < 1 || m.mastery_min_trials > 100) return 'O mínimo de tentativas precisa estar entre 1 e 100.'
  return null
}

export type TargetDraft = { key: string; id?: string; name: string }

/** Lista de alvos com ordem (setas), remover e adicionar vários de uma vez (um por linha). */
export function TargetListEditor({
  value,
  onChange,
  placeholder = 'Ex.: Boi',
  emptyText = 'Nenhum alvo ainda.',
}: {
  value: TargetDraft[]
  onChange: (v: TargetDraft[]) => void
  placeholder?: string
  emptyText?: string
}) {
  const [text, setText] = useState('')
  const add = () => {
    const names = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!names.length) return
    onChange([...value, ...names.map((name) => ({ key: crypto.randomUUID(), name }))])
    setText('')
  }
  const move = (i: number, d: number) => {
    const next = [...value]
    const [it] = next.splice(i, 1)
    next.splice(i + d, 0, it)
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <p className="text-base text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="flex flex-col divide-y rounded-xl border">
          {value.map((t, i) => (
            <li key={t.key} className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-7 text-center text-sm text-muted-foreground">{i + 1}</span>
              <Input
                value={t.name}
                onChange={(e) => onChange(value.map((x) => (x.key === t.key ? { ...x, name: e.target.value } : x)))}
                aria-label={`Alvo ${i + 1}`}
                className="h-11 flex-1 md:h-9"
              />
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${t.name}`}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${t.name}`}>
                <ArrowDown aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((x) => x.key !== t.key))} aria-label={`Remover ${t.name}`}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${placeholder}\n(cole vários, um por linha)`}
          className="min-h-20 flex-1"
          aria-label="Novos alvos"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !text.includes('\n')) {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}>
          <Plus aria-hidden /> Adicionar
        </Button>
      </div>
    </div>
  )
}

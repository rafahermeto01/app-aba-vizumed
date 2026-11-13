import { differenceInCalendarWeeks, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TIMEZONE, todayIso } from '@/lib/dates'

export type PeriodKey = '7' | '30' | '90' | '180' | '365' | 'all' | 'custom'
export type Period = { key: PeriodKey; from: string; to: string }

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 3 meses',
  '180': 'Últimos 6 meses',
  '365': 'Último ano',
  all: 'Todo o período',
  custom: 'Escolher datas',
}

/** Dia (AAAA-MM-DD) no fuso de São Paulo. */
export const dayIso = (ts: string | number | Date) => formatInTimeZone(new Date(ts), TIMEZONE, 'yyyy-MM-dd')

export function makePeriod(key: PeriodKey, custom?: { from: string; to: string }): Period {
  const today = todayIso()
  if (key === 'custom') return { key, from: custom?.from || today, to: custom?.to || today }
  if (key === 'all') return { key, from: '0000-01-01', to: '9999-12-31' }
  const from = format(subDays(new Date(`${today}T12:00:00`), Number(key) - 1), 'yyyy-MM-dd')
  return { key, from, to: today }
}

export const inPeriod = (ts: string | null | undefined, p: Period) => {
  if (!ts) return false
  const d = dayIso(ts)
  return d >= p.from && d <= p.to
}

export function usePeriod(initial: PeriodKey = '30') {
  const [period, setPeriod] = useState<Period>(() => makePeriod(initial))
  return [period, setPeriod] as const
}

/** "Nesta semana" / "Semana passada" / "novembro de 2026" (fuso de São Paulo). */
export function sessionGroupLabel(ts: string, now = new Date()): string {
  const d = toZonedTime(new Date(ts), TIMEZONE)
  const n = toZonedTime(now, TIMEZONE)
  const weeks = differenceInCalendarWeeks(n, d, { locale: ptBR })
  if (weeks === 0) return 'Nesta semana'
  if (weeks === 1) return 'Semana passada'
  const label = format(d, "MMMM 'de' yyyy", { locale: ptBR })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function PeriodPicker({ value, onChange, id = 'periodo' }: { value: Period; onChange: (p: Period) => void; id?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Período</Label>
        <Select value={value.key} onValueChange={(k) => onChange(makePeriod(k as PeriodKey, value))}>
          <SelectTrigger id={id} className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PERIOD_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.key === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-de`}>De</Label>
            <Input id={`${id}-de`} type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-ate`}>Até</Label>
            <Input
              id={`${id}-ate`}
              type="date"
              value={value.to}
              min={value.from}
              max={todayIso()}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}


import { formatDistanceStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

export const TIMEZONE = 'America/Sao_Paulo'

type DateInput = Date | string | number

const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d))

/** 05/03/2026 */
export function formatDate(d: DateInput): string {
  return formatInTimeZone(toDate(d), TIMEZONE, 'dd/MM/yyyy')
}

/** 05/03/2026 14:30 */
export function formatDateTime(d: DateInput): string {
  return formatInTimeZone(toDate(d), TIMEZONE, 'dd/MM/yyyy HH:mm')
}

/** 14:30 */
export function formatTime(d: DateInput): string {
  return formatInTimeZone(toDate(d), TIMEZONE, 'HH:mm')
}

/** Data de nascimento (sem fuso: "2020-03-14" → 14/03/2020). */
export function formatDateOnly(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** "há 22 horas" */
export function timeAgo(d: DateInput, now: Date = new Date()): string {
  return `há ${formatDistanceStrict(toDate(d), now, { locale: ptBR })}`
}

/** Saudação conforme o horário de São Paulo. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(formatInTimeZone(now, TIMEZONE, 'H'))
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Hoje em São Paulo, no formato do campo de data ("2026-11-13"). */
export function todayIso(now: Date = new Date()): string {
  return formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd')
}

/** Idade a partir da data de nascimento: "5 anos", "1 ano e 4 meses", "8 meses". */
export function ageLabel(isoBirth: string, now: Date = new Date()): string {
  const [by, bm, bd] = isoBirth.slice(0, 10).split('-').map(Number)
  const [ny, nm, nd] = todayIso(now).split('-').map(Number)
  let months = (ny - by) * 12 + (nm - bm)
  if (nd < bd) months -= 1
  if (months < 0) return ''
  const years = Math.floor(months / 12)
  const rest = months % 12
  const y = years === 1 ? '1 ano' : `${years} anos`
  const m = rest === 1 ? '1 mês' : `${rest} meses`
  if (years === 0) return m
  if (years < 3 && rest > 0) return `${y} e ${m}`
  return y
}

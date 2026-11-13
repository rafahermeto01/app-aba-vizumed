import { describe, expect, it } from 'vitest'

import { inPeriod, makePeriod, sessionGroupLabel } from '@/features/evolution/period'

describe('agrupamento das sessões', () => {
  // quinta-feira, 12/11/2026, 15h em São Paulo
  const now = new Date('2026-11-12T18:00:00Z')
  it('mesma semana', () => expect(sessionGroupLabel('2026-11-09T12:00:00Z', now)).toBe('Nesta semana'))
  it('semana passada', () => expect(sessionGroupLabel('2026-11-05T12:00:00Z', now)).toBe('Semana passada'))
  it('mais antigas: por mês', () => expect(sessionGroupLabel('2026-10-10T12:00:00Z', now)).toBe('Outubro de 2026'))
  // 02:30 de domingo em UTC = 23:30 de sábado em São Paulo → ainda é a semana passada
  it('respeita o fuso de São Paulo', () => expect(sessionGroupLabel('2026-11-08T02:30:00Z', now)).toBe('Semana passada'))
})

describe('período', () => {
  it('padrão de 30 dias inclui hoje', () => {
    const p = makePeriod('30')
    expect(inPeriod(new Date().toISOString(), p)).toBe(true)
  })
  it('datas escolhidas', () => {
    const p = makePeriod('custom', { from: '2026-11-01', to: '2026-11-10' })
    expect(inPeriod('2026-11-05T12:00:00Z', p)).toBe(true)
    expect(inPeriod('2026-11-11T12:00:00Z', p)).toBe(false)
  })
  it('todo o período', () => expect(inPeriod('2020-01-01T12:00:00Z', makePeriod('all'))).toBe(true))
})

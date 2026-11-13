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

import { contrastRatio, LEVEL_PALETTE, readableTextColor } from '@/features/programs/constants'

describe('cores dos níveis de ajuda', () => {
  it('toda cor da paleta deixa a sigla legível (contraste ≥ 4,5:1)', () => {
    for (const c of LEVEL_PALETTE) expect(contrastRatio(c, readableTextColor(c))).toBeGreaterThanOrEqual(4.5)
  })
  it('azul médio usa o texto que tiver mais contraste', () => expect(readableTextColor('#3b82f6')).toBe('#0f172a'))
  it('a paleta não tem verde, amarelo nem vermelho (reservados)', () => {
    for (const c of LEVEL_PALETTE) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
      expect(g > r && g > b).toBe(false) // nada esverdeado
      expect(r > 180 && g > 150 && b < 100).toBe(false) // nada amarelo
    }
  })
})

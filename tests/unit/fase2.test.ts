import { describe, expect, it } from 'vitest'

import { ageLabel, todayIso } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { maskPhone } from '@/lib/phone'

describe('telefone', () => {
  it('celular com 11 dígitos', () => expect(maskPhone('11988887777')).toBe('(11) 98888-7777'))
  it('fixo com 10 dígitos', () => expect(maskPhone('1133334444')).toBe('(11) 3333-4444'))
  it('parcial enquanto digita', () => expect(maskPhone('119')).toBe('(11) 9'))
  it('ignora letras', () => expect(maskPhone('(11) 9a8888')).toBe('(11) 9888-8'))
  it('vazio', () => expect(maskPhone('')).toBe(''))
})

describe('idade', () => {
  const now = new Date('2026-11-13T15:00:00Z')
  it('anos completos', () => expect(ageLabel('2020-03-14', now)).toBe('6 anos'))
  it('ainda não fez aniversário', () => expect(ageLabel('2020-11-20', now)).toBe('5 anos'))
  it('bebê em meses', () => expect(ageLabel('2026-03-01', now)).toBe('8 meses'))
  it('até 3 anos mostra meses', () => expect(ageLabel('2025-07-10', now)).toBe('1 ano e 4 meses'))
  it('hoje no fuso de São Paulo', () => expect(todayIso(new Date('2026-11-14T02:00:00Z'))).toBe('2026-11-13'))
})

describe('mensagens de erro', () => {
  it('CPF repetido', () => expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "learners_cpf_uniq"' })).toBe('Já existe um aprendiz com este CPF.'))
  it('sem internet', () => expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/internet/))
  it('sem permissão', () => expect(friendlyError({ code: '42501', message: 'x' })).toMatch(/permissão/))
  it('mensagem do banco em português', () => expect(friendlyError({ code: '23514', message: 'Informe o nome completo.' })).toBe('Informe o nome completo.'))
  it('erro técnico desconhecido vira mensagem simples', () => expect(friendlyError({ code: 'XX000', message: 'internal' })).toMatch(/Tente de novo/))
})

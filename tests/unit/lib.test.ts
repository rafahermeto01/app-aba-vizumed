import { describe, expect, it } from 'vitest'

import { isValidCpf, maskCpf } from '@/lib/cpf'
import { formatDate, formatDateOnly, formatDateTime, greeting } from '@/lib/dates'
import { avatarInitials, makeInitials } from '@/lib/initials'

describe('iniciais', () => {
  it('ignora conectivos', () => expect(makeInitials('Ana Beatriz de Souza')).toBe('ABS'))
  it('aceita espaços extras', () => expect(makeInitials('  pedro   exemplo silva ')).toBe('PES'))
  it('avatar usa no máximo 2 letras', () => expect(avatarInitials('Ana Beatriz de Souza')).toBe('AS'))
})

describe('CPF', () => {
  it('aceita CPF válido', () => expect(isValidCpf('529.982.247-25')).toBe(true))
  it('recusa dígito errado', () => expect(isValidCpf('529.982.247-24')).toBe(false))
  it('recusa repetidos', () => expect(isValidCpf('111.111.111-11')).toBe(false))
  it('aplica máscara', () => expect(maskCpf('52998224725')).toBe('529.982.247-25'))
  it('máscara parcial', () => expect(maskCpf('5299')).toBe('529.9'))
})

describe('datas (fuso de São Paulo)', () => {
  // 02:30 UTC de 06/03 ainda é 05/03 23:30 em São Paulo
  const d = new Date('2026-03-06T02:30:00Z')
  it('DD/MM/AAAA', () => expect(formatDate(d)).toBe('05/03/2026'))
  it('com hora', () => expect(formatDateTime(d)).toBe('05/03/2026 23:30'))
  it('data de nascimento sem fuso', () => expect(formatDateOnly('2020-03-14')).toBe('14/03/2020'))
  it('saudação pelo horário local', () => expect(greeting(d)).toBe('Boa noite'))
})

import type { Database } from '@/types/database'

export type MeasureType = Database['public']['Enums']['measure_type']
export type ProgramGoal = Database['public']['Enums']['program_goal']
export type Protocol = Database['public']['Enums']['protocol']
export type ProgramStatus = Database['public']['Enums']['program_status']
export type TargetStatus = Database['public']['Enums']['target_status']

/** Tipos de medida desta versão (análise de tarefas e múltiplas instruções virão depois). */
export const MEASURE_LABEL: Record<MeasureType, string> = {
  tentativa: 'Tentativa (+ / DICA / −)',
  frequencia: 'Frequência (contador)',
  duracao: 'Duração (cronômetro)',
}
export const MEASURE_SHORT: Record<MeasureType, string> = {
  tentativa: 'Tentativa',
  frequencia: 'Frequência',
  duracao: 'Duração',
}

export const GOAL_LABEL: Record<ProgramGoal, string> = {
  aquisicao: 'Aquisição',
  reducao: 'Redução',
}

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  vbmapp: 'VB-MAPP',
  ablls_r: 'ABLLS-R',
  denver_esdm: 'Denver / ESDM',
  peak: 'PEAK',
  afls: 'AFLS',
  portage: 'Portage',
  marcos_cv: 'Marcos do Comportamento Verbal',
  outro: 'Outro',
}

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  intervencao: 'Em intervenção',
  fila: 'Na fila',
  manutencao: 'Manutenção',
  masterizado: 'Masterizado',
}

export const TARGET_STATUS_ORDER: TargetStatus[] = ['intervencao', 'fila', 'manutencao', 'masterizado']

export function protocolText(protocol: Protocol | null, other: string | null): string | null {
  if (!protocol) return null
  return protocol === 'outro' ? other || 'Outro' : PROTOCOL_LABEL[protocol]
}

/**
 * Cores permitidas para os níveis de ajuda: roxos, azuis e cinzas.
 * Verde, amarelo e vermelho são RESERVADOS para acerto, dica e erro.
 */
// Todas com contraste ≥ 4,5:1 para a sigla (conferido).
export const LEVEL_PALETTE = [
  '#4c1d95',
  '#5b21b6',
  '#6d28d9',
  '#7c3aed',
  '#86198f',
  '#a21caf',
  '#3730a3',
  '#4338ca',
  '#4f46e5',
  '#1e3a8a',
  '#1e40af',
  '#2563eb',
  '#0369a1',
  '#0e7490',
  '#334155',
]

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Razão de contraste entre duas cores (WCAG). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Texto branco ou escuro: o que tiver mais contraste com o fundo. */
export function readableTextColor(hex: string): string {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#0f172a') ? '#ffffff' : '#0f172a'
}

export const DEFAULT_MASTERY = { mastery_min_pct: 80, mastery_sessions: 3, mastery_min_trials: 5 }

export function masteryText(m: { mastery_min_pct: number; mastery_sessions: number; mastery_min_trials: number }) {
  return `≥ ${m.mastery_min_pct}% de acerto independente em ${m.mastery_sessions} ${m.mastery_sessions === 1 ? 'sessão' : 'sessões consecutivas'}, com no mínimo ${m.mastery_min_trials} tentativas por sessão`
}

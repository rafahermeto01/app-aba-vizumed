// O "cofre" do aparelho: tudo da coleta é salvo PRIMEIRO aqui (IndexedDB),
// depois vai para o servidor pela fila de sincronização (outbox).
import Dexie, { type EntityTable } from 'dexie'

import type { MeasureType, ProgramGoal } from '@/features/programs/constants'

export type TrialResult = 'acerto' | 'erro' | 'dica'

export type SnapshotLevel = { id: string; name: string; abbreviation: string; color: string; sort_order: number; is_independent: boolean }

export type SnapshotTarget = {
  id: string
  name: string
  /** fase no momento em que a sessão começou */
  phase: 'intervencao' | 'manutencao'
  level_id: string | null
}

export type SnapshotProgram = {
  id: string
  name: string
  goal: ProgramGoal
  measure_type: MeasureType
  targets: SnapshotTarget[]
}

export type LocalSession = {
  /** = client_id = id no servidor (gerado no aparelho) */
  id: string
  user_id: string
  clinic_id: string
  learner_id: string
  learner_name: string
  learner_initials: string
  applicator_name: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  status: 'em_andamento' | 'finalizada'
  rating: number | null
  notes: string
  programs: SnapshotProgram[]
  levels: SnapshotLevel[]
  /** cronômetros de duração rodando: alvo → início */
  running: Record<string, string>
  /** Sessão #N, dado pelo servidor quando a sessão chega lá */
  number: number | null
  signature_data_url: string | null
  updated_at: string
}

export type LocalTrial = {
  /** = client_id */
  id: string
  session_id: string
  user_id: string
  clinic_id: string
  learner_id: string
  program_id: string
  target_id: string
  result: TrialResult | null
  prompt_level_id: string | null
  help_level_id: string | null
  value: number | null
  started_at: string | null
  recorded_at: string
  deleted_at: string | null
}

export type OutboxKind = 'session' | 'session_program' | 'trial' | 'signature' | 'finalize'

/** Ordem obrigatória de envio dentro de uma sessão. */
export const PRIORITY: Record<OutboxKind, number> = {
  session: 0,
  session_program: 1,
  trial: 2,
  signature: 3,
  finalize: 4,
}

export type OutboxItem = {
  /** `${kind}:${id}` — uma alteração nova do mesmo registro substitui a pendente */
  key: string
  kind: OutboxKind
  record_id: string
  session_id: string
  user_id: string
  priority: number
  payload: Record<string, unknown>
  /** muda a cada alteração: só apagamos da fila se o que foi enviado ainda é a versão atual */
  rev: string
  created_at: string
  attempts: number
  last_attempt_at: string | null
  last_error: string | null
}

export type KvItem = { key: string; value: string }

export class LovabaDB extends Dexie {
  sessions!: EntityTable<LocalSession, 'id'>
  trials!: EntityTable<LocalTrial, 'id'>
  outbox!: EntityTable<OutboxItem, 'key'>
  kv!: EntityTable<KvItem, 'key'>

  constructor(name = 'lovaba') {
    super(name)
    this.version(1).stores({
      sessions: 'id, user_id, learner_id, status, [user_id+status]',
      trials: 'id, session_id, [session_id+target_id], recorded_at',
      outbox: 'key, session_id, user_id, priority, created_at',
      kv: 'key',
    })
  }
}

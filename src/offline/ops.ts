// Operações da coleta. Cada uma grava no aparelho E coloca na fila, numa
// única transação: ou fica tudo salvo, ou nada.
import type { LocalSession, LocalTrial, LovabaDB, OutboxItem, OutboxKind, SnapshotLevel, SnapshotProgram, TrialResult } from './db'
import { PRIORITY } from './db'

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

export type StartSessionInput = {
  user_id: string
  clinic_id: string
  learner_id: string
  learner_name: string
  learner_initials: string
  applicator_name: string
  programs: SnapshotProgram[]
  levels: SnapshotLevel[]
}

export type RecordTrialInput = {
  session: LocalSession
  program_id: string
  target_id: string
  result?: TrialResult
  help_level_id?: string | null
  value?: number
  started_at?: string | null
}

export function createOps(db: LovabaDB, onEnqueue: () => void = () => {}) {
  async function enqueue(kind: OutboxKind, recordId: string, session: Pick<LocalSession, 'id' | 'user_id'>, payload: Record<string, unknown>) {
    const key = `${kind}:${recordId}`
    const existing = await db.outbox.get(key)
    const item: OutboxItem = {
      key,
      kind,
      record_id: recordId,
      session_id: session.id,
      user_id: session.user_id,
      priority: PRIORITY[kind],
      payload,
      rev: uuid(),
      created_at: existing?.created_at ?? now(),
      attempts: 0,
      last_attempt_at: null,
      last_error: null,
    }
    await db.outbox.put(item)
  }

  const sessionPayload = (s: LocalSession) => ({
    id: s.id,
    client_id: s.id,
    clinic_id: s.clinic_id,
    learner_id: s.learner_id,
    applicator_id: s.user_id,
    started_at: s.started_at,
    notes: s.notes || null,
    rating: s.rating,
  })

  const trialPayload = (t: LocalTrial) => ({
    id: t.id,
    client_id: t.id,
    clinic_id: t.clinic_id,
    learner_id: t.learner_id,
    session_id: t.session_id,
    target_id: t.target_id,
    result: t.result,
    prompt_level_id: t.prompt_level_id,
    help_level_id: t.help_level_id,
    value: t.value,
    started_at: t.started_at,
    recorded_at: t.recorded_at,
    deleted_at: t.deleted_at,
  })

  async function done<T>(p: Promise<T>): Promise<T> {
    const r = await p
    onEnqueue()
    return r
  }

  /** Passo 3 → 4: cria a sessão no aparelho (o cronômetro começa agora). */
  function startSession(input: StartSessionInput): Promise<LocalSession> {
    return done(
      db.transaction('rw', db.sessions, db.outbox, async () => {
        const session: LocalSession = {
          id: uuid(),
          ...input,
          started_at: now(),
          ended_at: null,
          duration_seconds: null,
          status: 'em_andamento',
          rating: null,
          notes: '',
          running: {},
          number: null,
          signature_data_url: null,
          updated_at: now(),
        }
        await db.sessions.add(session)
        await enqueue('session', session.id, session, sessionPayload(session))
        for (const p of input.programs) {
          const spId = uuid()
          await enqueue('session_program', spId, session, {
            id: spId,
            client_id: spId,
            clinic_id: session.clinic_id,
            session_id: session.id,
            learner_program_id: p.id,
          })
        }
        return session
      }),
    )
  }

  /** Um toque = uma tentativa (ou ocorrência / duração). */
  function recordTrial(input: RecordTrialInput): Promise<LocalTrial> {
    const { session } = input
    const program = session.programs.find((p) => p.id === input.program_id)
    const target = program?.targets.find((t) => t.id === input.target_id)
    if (!program || !target) throw new Error('Alvo não faz parte desta sessão.')
    return done(
      db.transaction('rw', db.trials, db.outbox, async () => {
        const trial: LocalTrial = {
          id: uuid(),
          session_id: session.id,
          user_id: session.user_id,
          clinic_id: session.clinic_id,
          learner_id: session.learner_id,
          program_id: program.id,
          target_id: target.id,
          result: input.result ?? null,
          prompt_level_id: program.measure_type === 'tentativa' ? target.level_id : null,
          help_level_id: input.result === 'dica' ? (input.help_level_id ?? target.level_id) : null,
          value: input.value ?? null,
          started_at: input.started_at ?? null,
          recorded_at: now(),
          deleted_at: null,
        }
        await db.trials.add(trial)
        await enqueue('trial', trial.id, session, trialPayload(trial))
        return trial
      }),
    )
  }

  /** Desfazer: não apaga, marca como desfeito (some da conta, fica rastreável). */
  function undoTrial(trialId: string): Promise<LocalTrial | null> {
    return done(
      db.transaction('rw', db.trials, db.outbox, async () => {
        const t = await db.trials.get(trialId)
        if (!t || t.deleted_at) return null
        const updated = { ...t, deleted_at: now() }
        await db.trials.put(updated)
        await enqueue('trial', t.id, { id: t.session_id, user_id: t.user_id }, trialPayload(updated))
        return updated
      }),
    )
  }

  /** Desfaz a última marcação da sessão (ou de um alvo). */
  async function undoLast(sessionId: string, targetId?: string): Promise<LocalTrial | null> {
    const trials = await db.trials.where('session_id').equals(sessionId).toArray()
    const last = trials
      .filter((t) => !t.deleted_at && (!targetId || t.target_id === targetId))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
    return last ? undoTrial(last.id) : null
  }

  async function patchSession(sessionId: string, patch: Partial<LocalSession>, sync = true): Promise<LocalSession> {
    return done(
      db.transaction('rw', db.sessions, db.outbox, async () => {
        const s = await db.sessions.get(sessionId)
        if (!s) throw new Error('Sessão não encontrada no aparelho.')
        if (s.status === 'finalizada') throw new Error('Esta sessão já foi finalizada.')
        const updated = { ...s, ...patch, updated_at: now() }
        await db.sessions.put(updated)
        if (sync) await enqueue('session', s.id, s, sessionPayload(updated))
        return updated
      }),
    )
  }

  /** Notas e avaliação (salvas no aparelho e enviadas enquanto a sessão está aberta). */
  const updateSession = (sessionId: string, patch: Pick<Partial<LocalSession>, 'notes' | 'rating'>) => patchSession(sessionId, patch)

  /** Cronômetro de duração: começa a contar (sobrevive a recarregar a página). */
  async function startTimer(sessionId: string, targetId: string) {
    const s = await db.sessions.get(sessionId)
    if (!s) return
    await patchSession(sessionId, { running: { ...s.running, [targetId]: now() } }, false)
  }

  /** Para o cronômetro e registra a duração em segundos. */
  async function stopTimer(sessionId: string, programId: string, targetId: string): Promise<LocalTrial | null> {
    const s = await db.sessions.get(sessionId)
    const startedAt = s?.running[targetId]
    if (!s || !startedAt) return null
    const seconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
    const { [targetId]: _removed, ...rest } = s.running
    const updated = await patchSession(sessionId, { running: rest }, false)
    return recordTrial({ session: updated, program_id: programId, target_id: targetId, value: seconds, started_at: startedAt })
  }

  /** Passo 6: finaliza (avaliação, notas, assinatura). Depois disso fica somente leitura. */
  function finalizeSession(sessionId: string, input: { rating: number | null; notes: string; signature_data_url: string }): Promise<LocalSession> {
    return done(
      db.transaction('rw', db.sessions, db.trials, db.outbox, async () => {
        const s = await db.sessions.get(sessionId)
        if (!s) throw new Error('Sessão não encontrada no aparelho.')
        if (s.status === 'finalizada') return s
        // Cronômetros esquecidos rodando: registra até agora.
        for (const [targetId, startedAt] of Object.entries(s.running)) {
          const program = s.programs.find((p) => p.targets.some((t) => t.id === targetId))
          if (!program) continue
          const t: LocalTrial = {
            id: uuid(),
            session_id: s.id,
            user_id: s.user_id,
            clinic_id: s.clinic_id,
            learner_id: s.learner_id,
            program_id: program.id,
            target_id: targetId,
            result: null,
            prompt_level_id: null,
            help_level_id: null,
            value: Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)),
            started_at: startedAt,
            recorded_at: now(),
            deleted_at: null,
          }
          await db.trials.add(t)
          await enqueue('trial', t.id, s, trialPayload(t))
        }
        const ended = now()
        const updated: LocalSession = {
          ...s,
          rating: input.rating,
          notes: input.notes,
          running: {},
          ended_at: ended,
          duration_seconds: Math.max(0, Math.round((new Date(ended).getTime() - new Date(s.started_at).getTime()) / 1000)),
          status: 'finalizada',
          signature_data_url: input.signature_data_url,
          updated_at: ended,
        }
        await db.sessions.put(updated)
        // Atualiza notas/avaliação ANTES de fechar (enquanto ainda pode escrever)
        await enqueue('session', s.id, s, sessionPayload(updated))
        const path = `${s.clinic_id}/${s.id}/aplicador.png`
        await enqueue('signature', s.id, s, { path, data_url: input.signature_data_url })
        await enqueue('finalize', s.id, s, {
          id: s.id,
          status: 'finalizada',
          ended_at: updated.ended_at,
          duration_seconds: updated.duration_seconds,
          rating: updated.rating,
          notes: updated.notes || null,
          applicator_signature_path: path,
        })
        return updated
      }),
    )
  }

  return { startSession, recordTrial, undoTrial, undoLast, updateSession, startTimer, stopTimer, finalizeSession }
}

export type CollectionOps = ReturnType<typeof createOps>

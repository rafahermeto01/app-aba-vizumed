// Fila de sincronização: envia o que está no aparelho para o servidor.
//
// Regras (seção 8 da especificação):
//  - Ordem obrigatória por sessão: sessão → programas → tentativas → assinatura → finalizar.
//  - Todo envio é "upsert" pelo client_id: reenviar nunca duplica.
//  - Só sai da fila depois que o servidor confirmou (e se não mudou enquanto enviava).
//  - Sem internet: para e tenta de novo depois. Recusa do servidor: guarda o
//    erro, NÃO apaga nada e tenta de novo mais tarde (com intervalo crescente).
import type { LovabaDB, OutboxItem } from './db'

export class RemoteError extends Error {
  kind: 'network' | 'auth' | 'rejected'
  constructor(kind: 'network' | 'auth' | 'rejected', message: string) {
    super(message)
    this.kind = kind
  }
}

/** O que o servidor precisa oferecer (Supabase no app; versão falsa nos testes). */
export interface Remote {
  upsertSession(payload: Record<string, unknown>): Promise<{ number: number | null }>
  upsertSessionProgram(payload: Record<string, unknown>): Promise<void>
  upsertTrial(payload: Record<string, unknown>): Promise<void>
  uploadSignature(path: string, dataUrl: string): Promise<void>
  finalizeSession(payload: Record<string, unknown>): Promise<void>
  /** renovar o login quando o servidor disser que expirou */
  refreshAuth?(): Promise<void>
}

export type SyncResult = { sent: number; pending: number; failed: number; stoppedOffline: boolean }

const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

function backoffOk(item: OutboxItem, nowMs: number) {
  if (!item.attempts || !item.last_attempt_at) return true
  const wait = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (item.attempts - 1))
  return nowMs - new Date(item.last_attempt_at).getTime() >= wait
}

export function createSyncEngine({
  db,
  remote,
  isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  getUserId,
  ignoreBackoff = false,
}: {
  db: LovabaDB
  remote: Remote
  isOnline?: () => boolean
  getUserId: () => Promise<string | null> | string | null
  ignoreBackoff?: boolean
}) {
  let running: Promise<SyncResult> | null = null
  const listeners = new Set<(syncing: boolean) => void>()
  const emit = (v: boolean) => listeners.forEach((l) => l(v))

  async function send(item: OutboxItem) {
    const p = item.payload
    switch (item.kind) {
      case 'session': {
        const { number } = await remote.upsertSession(p)
        if (number != null) await db.sessions.update(item.session_id, { number })
        return
      }
      case 'session_program':
        return remote.upsertSessionProgram(p)
      case 'trial':
        return remote.upsertTrial(p)
      case 'signature':
        return remote.uploadSignature(String(p.path), String(p.data_url))
      case 'finalize':
        return remote.finalizeSession(p)
    }
  }

  async function runOnce(): Promise<SyncResult> {
    const result: SyncResult = { sent: 0, pending: 0, failed: 0, stoppedOffline: false }
    const userId = await getUserId()
    if (!userId) return result
    if (!isOnline()) {
      result.stoppedOffline = true
      result.pending = await db.outbox.where('user_id').equals(userId).count()
      return result
    }

    const items = (await db.outbox.where('user_id').equals(userId).toArray()).sort(
      (a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at),
    )
    // Sessões com algo travado: nada posterior dela é enviado (preserva a ordem).
    const blocked = new Set<string>()
    let refreshedAuth = false

    for (const item of items) {
      if (blocked.has(item.session_id)) continue
      if (!ignoreBackoff && !backoffOk(item, Date.now())) {
        blocked.add(item.session_id)
        continue
      }
      try {
        await send(item)
        // Só remove se ninguém alterou o item enquanto ele era enviado
        await db.transaction('rw', db.outbox, async () => {
          const current = await db.outbox.get(item.key)
          if (current && current.rev === item.rev) await db.outbox.delete(item.key)
        })
        result.sent++
      } catch (e) {
        const err = e instanceof RemoteError ? e : new RemoteError('network', String((e as Error)?.message ?? e))
        if (err.kind === 'network') {
          result.stoppedOffline = true
          break
        }
        if (err.kind === 'auth' && !refreshedAuth && remote.refreshAuth) {
          refreshedAuth = true
          await remote.refreshAuth().catch(() => undefined)
          blocked.add(item.session_id)
          continue
        }
        await db.outbox.update(item.key, {
          attempts: item.attempts + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: err.message.slice(0, 500),
        })
        blocked.add(item.session_id)
      }
    }

    const left = await db.outbox.where('user_id').equals(userId).toArray()
    result.pending = left.length
    result.failed = left.filter((i) => i.attempts > 0).length
    return result
  }

  /** Roda a fila (se já estiver rodando, espera a rodada atual). */
  function sync(): Promise<SyncResult> {
    if (running) return running
    emit(true)
    running = runOnce().finally(() => {
      running = null
      emit(false)
    })
    return running
  }

  function onSyncingChange(cb: (syncing: boolean) => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  return { sync, onSyncingChange, isSyncing: () => running !== null }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>

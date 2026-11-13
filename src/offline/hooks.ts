import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'

import type { LocalSession, LocalTrial } from './db'
import { db, engine } from './index'

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export type SyncState = 'saved' | 'syncing' | 'offline' | 'error'

/** "Salvo" / "Salvo no aparelho, sincronizando…" / "Sem internet, salvo no aparelho". */
export function useSyncStatus(userId: string | undefined) {
  const online = useOnline()
  const [syncing, setSyncing] = useState(engine.isSyncing())
  useEffect(() => {
    const off = engine.onSyncingChange(setSyncing)
    return () => {
      off()
    }
  }, [])
  const counts = useLiveQuery(
    async () => {
      if (!userId) return { pending: 0, failed: 0 }
      const items = await db.outbox.where('user_id').equals(userId).toArray()
      return { pending: items.length, failed: items.filter((i) => i.attempts >= 3).length }
    },
    [userId],
    { pending: 0, failed: 0 },
  )
  let state: SyncState = 'saved'
  if (counts.pending > 0) state = !online ? 'offline' : counts.failed > 0 ? 'error' : 'syncing'
  else if (!online) state = 'offline'
  return { state, online, syncing, ...counts }
}

/** Sessões em andamento neste aparelho (para "Continuar sessão"). */
export function useOpenSessions(userId: string | undefined, learnerId?: string) {
  return useLiveQuery(
    async () => {
      if (!userId) return [] as LocalSession[]
      const list = await db.sessions.where('[user_id+status]').equals([userId, 'em_andamento']).toArray()
      return list.filter((s) => !learnerId || s.learner_id === learnerId).sort((a, b) => b.started_at.localeCompare(a.started_at))
    },
    [userId, learnerId],
    [] as LocalSession[],
  )
}

/** Sessões deste aparelho que ainda não chegaram inteiras ao servidor. */
export function useUnsyncedSessionIds(userId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!userId) return new Set<string>()
      const items = await db.outbox.where('user_id').equals(userId).toArray()
      return new Set(items.map((i) => i.session_id))
    },
    [userId],
    new Set<string>(),
  )
}

export function useLocalSession(id: string | undefined) {
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
}

export function useSessionTrials(sessionId: string | undefined) {
  return useLiveQuery(
    async () => (sessionId ? db.trials.where('session_id').equals(sessionId).sortBy('recorded_at') : ([] as LocalTrial[])),
    [sessionId],
    [] as LocalTrial[],
  )
}

/** Sessões finalizadas recentemente neste aparelho (para mostrar mesmo sem internet). */
export function useLocalSessions(userId: string | undefined, learnerId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!userId || !learnerId) return [] as LocalSession[]
      const list = await db.sessions.where('learner_id').equals(learnerId).toArray()
      return list.filter((s) => s.user_id === userId).sort((a, b) => b.started_at.localeCompare(a.started_at))
    },
    [userId, learnerId],
    [] as LocalSession[],
  )
}

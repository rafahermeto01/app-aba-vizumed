// Instâncias do app: banco do aparelho, operações da coleta e fila de sincronização.
import { supabase } from '@/lib/supabase'

import { LovabaDB } from './db'
import { createOps } from './ops'
import { supabaseRemote } from './remote'
import { createSyncEngine } from './sync'

export const db = new LovabaDB()

let currentUser: string | null = null

export const engine = createSyncEngine({
  db,
  remote: supabaseRemote(supabase),
  getUserId: () => currentUser,
})

let pendingTimer: ReturnType<typeof setTimeout> | null = null

/** Pede uma sincronização logo (agrupa vários toques seguidos num envio). */
export function scheduleSync(delay = 400) {
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    void engine.sync()
  }, delay)
}

export const ops = createOps(db, () => scheduleSync())

/** Quem está logado (a fila só envia os registros dessa pessoa). */
export function setSyncUser(userId: string | null) {
  currentUser = userId
  if (userId) scheduleSync(100)
}

let loopStarted = false

/** A fila sincroniza sozinha: ao voltar a conexão, ao reabrir o app e a cada 5 s com pendências. */
export function startSyncLoop() {
  if (loopStarted || typeof window === 'undefined') return
  loopStarted = true
  window.addEventListener('online', () => scheduleSync(100))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(100)
  })
  setInterval(async () => {
    if (!currentUser || !navigator.onLine) return
    const pending = await db.outbox.where('user_id').equals(currentUser).count()
    if (pending > 0) void engine.sync()
  }, 5_000)
}

/** Quantos registros desta pessoa ainda não chegaram ao servidor. */
export function pendingCount(userId: string) {
  return db.outbox.where('user_id').equals(userId).count()
}

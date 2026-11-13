// Guarda no aparelho uma cópia das telas já carregadas (aprendizes, programas,
// níveis de ajuda…), para o app abrir e funcionar sem internet.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'

import { db } from './index'

export const QUERY_CACHE_KEY = 'lovaba-query-cache'

export const queryPersister = createAsyncStoragePersister({
  key: QUERY_CACHE_KEY,
  throttleTime: 1_000,
  storage: {
    getItem: async (key) => (await db.kv.get(key))?.value ?? null,
    setItem: async (key, value) => {
      await db.kv.put({ key, value })
    },
    removeItem: async (key) => {
      await db.kv.delete(key)
    },
  },
})

/** Links temporários de fotos expiram: não vale a pena guardar. */
const NOT_PERSISTED = new Set(['signed-url', 'home-stats'])

export function shouldPersistQuery(query: Query) {
  return query.state.status === 'success' && !NOT_PERSISTED.has(String(query.queryKey[0]))
}

/** Ao sair da conta: apaga a cópia das telas (privacidade). Os registros da coleta ficam. */
export async function clearPersistedQueries() {
  await db.kv.delete(QUERY_CACHE_KEY)
}

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

// Proteção: a chave de servidor (service_role / secret) NUNCA pode estar no app.
function looksLikeServerKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(atob(k.split('.')[1] ?? '')) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}
if (key && looksLikeServerKey(key)) {
  throw new Error(
    'A chave em VITE_SUPABASE_ANON_KEY é a chave SECRETA do servidor. Troque pela chave pública (anon/publishable).',
  )
}

export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: {
    persistSession: true, // a terapeuta continua logada mesmo fechando o navegador
    autoRefreshToken: true, // renova o acesso sozinho durante o atendimento
    detectSessionInUrl: true, // links de "redefinir senha"
    storageKey: 'lovaba-auth',
  },
})

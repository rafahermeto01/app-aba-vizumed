// Utilidades compartilhadas pelos scripts locais (rodam no SEU computador,
// nunca no navegador). Lê as variáveis do arquivo .env.local.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    fail(`Faltou preencher ${name} no arquivo .env.local`)
  }
  return value
}

export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

export function step(message: string) {
  console.log(`• ${message}`)
}

/** Cliente com a chave de servidor (ignora as regras de RLS). Só para scripts. */
export function adminClient(): SupabaseClient {
  const url = requireEnv('VITE_SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Cliente com a chave pública, igual ao app no navegador. */
export function publicClient(): SupabaseClient {
  const url = requireEnv('VITE_SUPABASE_URL')
  const key = requireEnv('VITE_SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Lança erro legível se a resposta do Supabase trouxe erro. */
export function check<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) {
    fail(`${what}: ${res.error.message}`)
  }
  return res.data as NonNullable<T>
}

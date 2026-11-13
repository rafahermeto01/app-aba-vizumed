// Implementação do servidor (Supabase) para a fila de sincronização.
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import { RemoteError, type Remote } from './sync'

type PgLikeError = { message?: string; code?: string; status?: number; statusCode?: string | number; name?: string }

/** Decide se foi falta de internet, login vencido ou recusa de verdade do servidor. */
export function classify(error: PgLikeError, status?: number): RemoteError {
  const msg = String(error?.message ?? '')
  const lower = msg.toLowerCase()
  const st = status ?? Number(error?.status ?? error?.statusCode ?? 0)
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('fetch failed') ||
    error?.name === 'AuthRetryableFetchError' ||
    st === 0 ||
    st === 408 ||
    st === 429 ||
    st >= 500
  ) {
    return new RemoteError('network', msg || 'sem conexão')
  }
  if (st === 401 || lower.includes('jwt') || error?.code === 'PGRST301' || error?.code === 'PGRST303') {
    return new RemoteError('auth', msg)
  }
  return new RemoteError('rejected', `${error?.code ?? st ?? ''} ${msg}`.trim())
}

async function guard<T>(p: PromiseLike<{ data: T; error: PgLikeError | null; status?: number }>): Promise<T> {
  let res: { data: T; error: PgLikeError | null; status?: number }
  try {
    res = await p
  } catch (e) {
    throw classify(e as PgLikeError)
  }
  if (res.error) throw classify(res.error, res.status)
  return res.data
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function supabaseRemote(supabase: SupabaseClient<Database>): Remote {
  return {
    async upsertSession(payload) {
      const rows = await guard(
        supabase
          .from('sessions')
          .upsert(payload as never, { onConflict: 'client_id' })
          .select('number'),
      )
      return { number: (rows as { number: number | null }[])?.[0]?.number ?? null }
    },
    async upsertSessionProgram(payload) {
      await guard(supabase.from('session_programs').upsert(payload as never, { onConflict: 'client_id' }))
    },
    async upsertTrial(payload) {
      await guard(supabase.from('trials').upsert(payload as never, { onConflict: 'client_id' }))
    },
    async uploadSignature(path, dataUrl) {
      let res
      try {
        res = await supabase.storage.from('signatures').upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/png', upsert: false })
      } catch (e) {
        throw classify(e as PgLikeError)
      }
      if (res.error) {
        const e = res.error as PgLikeError
        const msg = String(e.message ?? '').toLowerCase()
        // Já enviada antes (reenvio): tudo certo.
        if (msg.includes('already exists') || msg.includes('duplicate') || String(e.statusCode) === '409') return
        throw classify(e)
      }
    },
    async finalizeSession(payload) {
      const { id, ...changes } = payload as { id: string } & Record<string, unknown>
      const rows = await guard(
        supabase
          .from('sessions')
          .update(changes as never)
          .eq('id', id)
          .select('status'),
      )
      if ((rows as unknown[]).length === 0) {
        // Pode já estar finalizada (reenvio depois de a resposta se perder)
        const current = await guard(supabase.from('sessions').select('status').eq('id', id).maybeSingle())
        if ((current as { status: string } | null)?.status === 'finalizada') return
        throw new RemoteError('rejected', 'não foi possível finalizar a sessão no servidor')
      }
    },
    async refreshAuth() {
      await supabase.auth.refreshSession()
    },
  }
}

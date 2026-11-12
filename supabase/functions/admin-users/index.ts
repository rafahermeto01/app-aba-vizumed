// LovABA · Edge Function "admin-users"
// Gestão da equipe pela coordenação. Roda no servidor do Supabase: é o ÚNICO
// lugar (além dos scripts locais) que usa a chave de servidor. O app chama
// esta função com o login de quem está usando; aqui conferimos se é mesmo um(a)
// Coordenador(a) ativo(a) antes de fazer qualquer coisa.
//
// Ações (corpo JSON, campo "action"):
//   create          { full_name, email, role, password }   → cria membro com senha provisória
//   update          { user_id, full_name?, role? }          → altera nome / perfil de acesso
//   reset_password  { user_id, password }                    → nova senha provisória
//   set_active      { user_id, active }                      → desativa / reativa
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROLES = ['coordenador', 'supervisor', 'aplicador'] as const
type Role = (typeof ROLES)[number]
const MIN_PASSWORD = 8
const BAN_FOREVER = '876000h' // ~100 anos

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  // Projetos novos: chaves "sb_secret_…" ficam em SUPABASE_SECRET_KEYS (JSON)
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const k = keys.default ?? Object.values(keys)[0]
  if (!k) throw new Error('Chave de servidor não configurada')
  return k
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function text(v: unknown, field: string, max = 200): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) throw new HttpError(400, `Preencha o campo ${field}.`)
  if (s.length > max) throw new HttpError(400, `O campo ${field} está muito longo.`)
  return s
}

function role(v: unknown): Role {
  if (typeof v === 'string' && (ROLES as readonly string[]).includes(v)) return v as Role
  throw new HttpError(400, 'Perfil de acesso inválido.')
}

function password(v: unknown): string {
  if (typeof v !== 'string' || v.length < MIN_PASSWORD) {
    throw new HttpError(400, `A senha provisória precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
  }
  if (v.length > 72) throw new HttpError(400, 'A senha provisória está muito longa.')
  return v
}

function email(v: unknown): string {
  const s = text(v, 'e-mail').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new HttpError(400, 'E-mail inválido.')
  return s
}

type Me = { id: string; clinic_id: string }

/** Quem está chamando precisa ser Coordenador(a) ativo(a), com a senha já trocada. */
async function requireCoordinator(req: Request): Promise<Me> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.')

  const { data: me } = await admin
    .from('profiles')
    .select('id, clinic_id, role, active, must_change_password, deleted_at')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!me || !me.active || me.must_change_password || me.deleted_at || me.role !== 'coordenador') {
    throw new HttpError(403, 'Apenas a coordenação pode gerenciar a equipe.')
  }
  return { id: me.id, clinic_id: me.clinic_id }
}

/** O membro alvo precisa ser da mesma clínica, e ninguém mexe no próprio acesso por aqui. */
async function requireMember(me: Me, userId: unknown, allowSelf = false) {
  if (typeof userId !== 'string') throw new HttpError(400, 'Membro não informado.')
  if (!allowSelf && userId === me.id) throw new HttpError(400, 'Você não pode alterar o seu próprio acesso.')
  const { data: member } = await admin
    .from('profiles')
    .select('id, clinic_id, deleted_at')
    .eq('id', userId)
    .maybeSingle()
  if (!member || member.clinic_id !== me.clinic_id || member.deleted_at) {
    throw new HttpError(404, 'Membro não encontrado.')
  }
  return member
}

async function markProvisional(userId: string) {
  const { error } = await admin.rpc('mark_provisional_password', { p_user: userId })
  if (error) throw error
}

async function createMember(me: Me, body: Record<string, unknown>) {
  const fullName = text(body.full_name, 'nome')
  const mail = email(body.email)
  const r = role(body.role)
  const pass = password(body.password)

  const { data: existing } = await admin.from('profiles').select('id').ilike('email', mail).maybeSingle()
  if (existing) throw new HttpError(409, 'Já existe uma pessoa cadastrada com este e-mail.')

  const created = await admin.auth.admin.createUser({
    email: mail,
    password: pass,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    const m = created.error?.message.toLowerCase() ?? ''
    if (m.includes('already') || m.includes('exists')) throw new HttpError(409, 'Já existe uma pessoa cadastrada com este e-mail.')
    if (m.includes('password')) throw new HttpError(400, 'Senha provisória fraca. Use pelo menos 8 caracteres.')
    throw created.error ?? new Error('createUser falhou')
  }
  const userId = created.data.user.id

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    clinic_id: me.clinic_id,
    full_name: fullName,
    email: mail,
    role: r,
    must_change_password: true,
    created_by: me.id,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId) // desfaz: sem perfil, sem login órfão
    throw profileError
  }
  await markProvisional(userId)
  return { id: userId }
}

async function updateMember(me: Me, body: Record<string, unknown>) {
  const changes: Record<string, unknown> = {}
  if (body.full_name !== undefined) changes.full_name = text(body.full_name, 'nome')
  if (body.role !== undefined) {
    changes.role = role(body.role)
  }
  // Nome pode ser alterado no próprio cadastro; perfil de acesso, não.
  await requireMember(me, body.user_id, changes.role === undefined)
  if (Object.keys(changes).length === 0) return { id: body.user_id }
  const { error } = await admin.from('profiles').update(changes).eq('id', body.user_id as string)
  if (error) throw error
  return { id: body.user_id }
}

async function resetPassword(me: Me, body: Record<string, unknown>) {
  const member = await requireMember(me, body.user_id)
  const pass = password(body.password)
  const { error } = await admin.auth.admin.updateUserById(member.id, { password: pass })
  if (error) {
    if (error.message.toLowerCase().includes('password')) throw new HttpError(400, 'Senha provisória fraca. Use pelo menos 8 caracteres.')
    throw error
  }
  await markProvisional(member.id)
  return { id: member.id }
}

async function setActive(me: Me, body: Record<string, unknown>) {
  const member = await requireMember(me, body.user_id)
  if (typeof body.active !== 'boolean') throw new HttpError(400, 'Informe se o acesso fica ativo ou não.')
  const active = body.active
  // 1) o banco corta o acesso na hora (todas as regras checam "active")
  const { error } = await admin.from('profiles').update({ active }).eq('id', member.id)
  if (error) throw error
  // 2) o login também fica bloqueado (não consegue entrar nem renovar o acesso)
  const ban = await admin.auth.admin.updateUserById(member.id, { ban_duration: active ? 'none' : BAN_FOREVER })
  if (ban.error) throw ban.error
  return { id: member.id, active }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })
  try {
    const me = await requireCoordinator(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    switch (body.action) {
      case 'create':
        return json(200, await createMember(me, body))
      case 'update':
        return json(200, await updateMember(me, body))
      case 'reset_password':
        return json(200, await resetPassword(me, body))
      case 'set_active':
        return json(200, await setActive(me, body))
      default:
        return json(400, { error: 'Ação desconhecida.' })
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message })
    console.error(e)
    return json(500, { error: 'Não foi possível concluir agora. Tente de novo em instantes.' })
  }
})

// Testa a gestão de equipe (Edge Function "admin-users") no projeto de TESTES.
// Usa as contas fictícias do seed-demo e um membro de teste
// "teste.equipe@demo.lovaba.test", que fica DESATIVADO no final.
//
// Rode:  npm run test:equipe
import { randomBytes } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { adminClient, fail, publicClient, requireEnv } from './_lib.ts'

const demoPassword = requireEnv('DEMO_PASSWORD')
const TEST_EMAIL = 'teste.equipe@demo.lovaba.test'
const tempPassword = () => `Prov-${randomBytes(6).toString('base64url')}`

let failures = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? '✔' : '✖'} ${msg}`)
  if (!cond) failures++
}

async function login(email: string, password: string): Promise<SupabaseClient> {
  const sb = publicClient()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return sb
}

/** Chama a função e devolve { status, body } (sem lançar erro). */
async function call(sb: SupabaseClient, body: Record<string, unknown>) {
  const { data, error } = await sb.functions.invoke('admin-users', { body })
  if (!error) return { status: 200, body: data as Record<string, unknown> }
  const ctx = (error as { context?: Response }).context
  const status = ctx?.status ?? 0
  const parsed = ctx ? ((await ctx.json().catch(() => ({}))) as Record<string, unknown>) : {}
  return { status, body: parsed }
}

const coord = await login('coordenadora@demo.lovaba.test', demoPassword).catch((e) =>
  fail(`${(e as Error).message}. Você rodou "npm run seed:demo"?`),
)
const ana = await login('ana.at@demo.lovaba.test', demoPassword)

// 1. Só a coordenação usa a função
const denied = await call(ana, { action: 'create', full_name: 'Intrusa', email: 'intrusa@demo.lovaba.test', role: 'coordenador', password: tempPassword() })
ok(denied.status === 403, 'AT NÃO consegue criar membros (bloqueado no servidor)')

const anon = await call(publicClient(), { action: 'create', full_name: 'X', email: 'x@demo.lovaba.test', role: 'aplicador', password: tempPassword() })
ok(anon.status === 401 || anon.status === 403, 'sem login: bloqueado')

// 2. Criar (ou reaproveitar) o membro de teste com senha provisória
let pass1 = tempPassword()
const admin = adminClient()
const existing = (await admin.from('profiles').select('id').eq('email', TEST_EMAIL).maybeSingle()).data
let memberId: string
if (existing) {
  memberId = existing.id
  const re = await call(coord, { action: 'set_active', user_id: memberId, active: true })
  const rp = await call(coord, { action: 'reset_password', user_id: memberId, password: pass1 })
  ok(re.status === 200 && rp.status === 200, 'reativa o membro de teste e define nova senha provisória')
} else {
  const created = await call(coord, { action: 'create', full_name: 'Teste Equipe (demo)', email: TEST_EMAIL, role: 'aplicador', password: pass1 })
  ok(created.status === 200 && typeof created.body.id === 'string', 'coordenação cria membro com senha provisória')
  memberId = created.body.id as string
}

const dup = await call(coord, { action: 'create', full_name: 'Duplicado', email: TEST_EMAIL, role: 'aplicador', password: tempPassword() })
ok(dup.status === 409, 'não cria duas pessoas com o mesmo e-mail')

const short = await call(coord, { action: 'reset_password', user_id: memberId, password: '1234' })
ok(short.status === 400, 'recusa senha provisória com menos de 8 caracteres')

// 3. Primeiro login: obrigado a trocar a senha, não lê nada
const mustChange = async (sb: SupabaseClient) =>
  (await sb.from('profiles').select('must_change_password').eq('id', memberId).single()).data?.must_change_password

let member = await login(TEST_EMAIL, pass1)
ok((await mustChange(member)) === true, 'no primeiro login, a troca de senha é obrigatória')
ok(((await member.from('learners').select('id')).data ?? []).length === 0, 'antes de trocar, não lê nenhum aprendiz')

const finalPass = tempPassword()
await member.auth.updateUser({ password: finalPass })
const done = await member.rpc('complete_password_change')
ok(done.data === true, 'depois de trocar a senha, o acesso é liberado')

// 4. Coordenação muda o perfil de acesso e redefine a senha
const up = await call(coord, { action: 'update', user_id: memberId, role: 'supervisor', full_name: 'Teste Equipe (demo)' })
const newRole = (await admin.from('profiles').select('role').eq('id', memberId).single()).data?.role
ok(up.status === 200 && newRole === 'supervisor', 'coordenação altera o perfil de acesso')

pass1 = tempPassword()
await call(coord, { action: 'reset_password', user_id: memberId, password: pass1 })
member = await login(TEST_EMAIL, pass1)
ok((await mustChange(member)) === true, 'senha redefinida volta a ser provisória (troca obrigatória)')

// 5. Ninguém mexe no próprio acesso
const me = (await coord.auth.getUser()).data.user!
const self = await call(coord, { action: 'set_active', user_id: me.id, active: false })
ok(self.status === 400, 'coordenação não consegue desativar a si mesma')

// 6. Desativar: perde o acesso na hora
const off = await call(coord, { action: 'set_active', user_id: memberId, active: false })
ok(off.status === 200, 'coordenação desativa o membro')
const blocked = await publicClient().auth.signInWithPassword({ email: TEST_EMAIL, password: pass1 })
ok(Boolean(blocked.error), 'membro desativado não consegue mais entrar')
await coord.auth.signOut()
await ana.auth.signOut()

console.log(failures ? `\n✖ ${failures} verificação(ões) falharam.\n` : '\n✔ Gestão de equipe funcionando.\n')
process.exit(failures ? 1 : 0)

// Prova as regras de segurança no projeto Supabase de TESTES, entrando como a
// AT fictícia "Ana" (criada pelo seed-demo). Não altera nenhum dado.
//
// Rode:  npm run test:rls
//
// (As regras também são testadas sem internet, num banco temporário: npm run test:db)
import { adminClient, fail, publicClient, requireEnv } from './_lib.ts'

const password = requireEnv('DEMO_PASSWORD')
let failures = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? '✔' : '✖'} ${msg}`)
  if (!cond) failures++
}

// 0. Sem login, nada.
const anon = publicClient()
const anonLearners = await anon.from('learners').select('id')
ok((anonLearners.data ?? []).length === 0, 'sem login: não lê nenhum aprendiz')

// 1. Login como Ana (vinculada a Pedro e Laura).
const sb = publicClient()
const login = await sb.auth.signInWithPassword({ email: 'ana.at@demo.lovaba.test', password })
if (login.error) fail(`Não consegui entrar como a AT demo: ${login.error.message}. Você rodou "npm run seed:demo"?`)

const { data: learners, error } = await sb.from('learners').select('id, full_name')
if (error) fail(error.message)
const names = (learners ?? []).map((l) => l.full_name).sort()
// Vê os vinculados a ela no seed (Pedro e Laura) e NENHUM dos que são só do Bruno (Davi e Alice).
// (Pode ver outros se a coordenação a vinculou a novos aprendizes.)
const notMine = ['Davi Exemplo Souza', 'Alice Exemplo Lima']
ok(
  names.includes('Pedro Exemplo Silva') && names.includes('Laura Exemplo Costa') && !names.some((n) => notMine.includes(n)),
  `vê os aprendizes vinculados e nenhum dos outros (${names.join(', ')})`,
)

// Busca direta por um aprendiz NÃO vinculado (Davi) usando a chave de servidor só para descobrir o id.
const admin = adminClient()
const davi = (await admin.from('learners').select('id').eq('full_name', 'Davi Exemplo Souza').single()).data
if (!davi) fail('Aprendiz demo "Davi" não encontrado. Rode "npm run seed:demo".')
const direct = await sb.from('learners').select('id').eq('id', davi.id)
ok((direct.data ?? []).length === 0, 'NÃO consegue ler o aprendiz não vinculado (Davi), nem buscando pelo id')
const daviSessions = await sb.from('sessions').select('id').eq('learner_id', davi.id)
ok((daviSessions.data ?? []).length === 0, 'NÃO vê as sessões do Davi')

// 2. Não altera sessão finalizada.
const finalized = await sb.from('sessions').select('id, notes').eq('status', 'finalizada').limit(1).single()
if (finalized.data) {
  const upd = await sb.from('sessions').update({ notes: 'tentativa de alteração' }).eq('id', finalized.data.id).select('id')
  ok((upd.data ?? []).length === 0, 'NÃO altera uma sessão já finalizada')
} else {
  ok(false, 'sessão finalizada de demonstração não encontrada')
}

// 3. Não cria programa nem aprendiz.
const lp = await sb.from('learner_programs').insert({ clinic_id: '00000000-0000-0000-0000-000000000000', learner_id: learners![0].id, name: 'Teste' }).select('id')
ok(!!lp.error, 'NÃO cria programa')
const newLearner = await sb.from('learners').insert({ clinic_id: '00000000-0000-0000-0000-000000000000', full_name: 'Teste' }).select('id')
ok(!!newLearner.error, 'NÃO cadastra aprendiz')

// 3b. Vê os alvos do aprendiz dela, mas não muda nível nem masteriza.
const myTarget = (await sb.from('targets').select('id, current_prompt_level_id').eq('status', 'intervencao').limit(1).maybeSingle()).data
if (myTarget) {
  const lvl = await sb.from('targets').update({ current_prompt_level_id: myTarget.current_prompt_level_id }).eq('id', myTarget.id).select('id')
  ok((lvl.data ?? []).length === 0, 'NÃO muda o nível de ajuda de um alvo')
  const master = await sb.rpc('set_target_status', { p_target: myTarget.id, p_status: 'masterizado' })
  ok(Boolean(master.error), 'NÃO masteriza alvo')
} else {
  ok(false, 'alvo em intervenção de demonstração não encontrado')
}

// 4. Não muda o próprio perfil de acesso.
const me = login.data.user!.id
const promote = await sb.from('profiles').update({ role: 'coordenador' }).eq('id', me).select('id')
ok(!!promote.error || (promote.data ?? []).length === 0, 'NÃO consegue se promover a coordenadora')

await sb.auth.signOut()
console.log(failures ? `\n✖ ${failures} verificação(ões) falharam.\n` : '\n✔ Todas as regras de segurança funcionaram.\n')
process.exit(failures ? 1 : 0)

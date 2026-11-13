// Aplica as migrations do LovABA num Postgres em memória (PGlite) com stubs
// do Supabase (auth, storage, papéis) e testa as regras principais.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'

const MIG = process.argv[2] ?? path.resolve(import.meta.dirname, '../../supabase/migrations')
const db = new PGlite()
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok  ', msg) } else { fail++; console.log('  FAIL', msg) } }
async function expectError(fn, msg) {
  try { await fn(); fail++; console.log('  FAIL (sem erro)', msg) }
  catch (e) { pass++; console.log('  ok  ', msg, '→', e.message.split('\n')[0]) }
}

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::json->>'role' $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

for (const f of fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')); console.log('migration ok:', f) }
  catch (e) { console.log('MIGRATION FAILED:', f, '\n', e.message); process.exit(1) }
}

const U = {
  coord: '00000000-0000-0000-0000-0000000000c1',
  sup:   '00000000-0000-0000-0000-0000000000d1',
  at1:   '00000000-0000-0000-0000-0000000000a1',
  at2:   '00000000-0000-0000-0000-0000000000a2',
  novo:  '00000000-0000-0000-0000-0000000000b1',
}

async function asAdmin() { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
async function as(uid) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: 'authenticated' })}', false); set role authenticated;`)
}
const q = async (sql, params) => (await db.query(sql, params)).rows

// --- dados de teste (como admin) ------------------------------------------
await asAdmin()
const [clinic] = await q(`insert into clinics (name) values ('Clínica Teste') returning id`)
const C = clinic.id
const levels = await q(`select id, abbreviation from prompt_levels where clinic_id = $1 order by sort_order`, [C])
ok(levels.length === 7, 'clínica nova recebe 7 níveis de ajuda padrão')
const L = Object.fromEntries(levels.map(l => [l.abbreviation, l.id]))

for (const [k, id] of Object.entries(U)) {
  await q(`insert into auth.users (id, email, encrypted_password) values ($1, $2, 'hash-inicial')`, [id, k + '@teste.test'])
}
const role = { coord: 'coordenador', sup: 'supervisor', at1: 'aplicador', at2: 'aplicador', novo: 'aplicador' }
for (const [k, id] of Object.entries(U)) {
  await q(`insert into profiles (id, clinic_id, full_name, email, role, must_change_password) values ($1,$2,$3,$4,$5,false)`,
    [id, C, k, k + '@teste.test', role[k]])
}
await q(`select mark_provisional_password($1)`, [U.novo])

const [l1] = await q(`insert into learners (clinic_id, full_name, cpf) values ($1, 'Pedro Exemplo da Silva', '529.982.247-25') returning id, initials, cpf`, [C])
ok(l1.initials === 'PES', 'iniciais automáticas (PES): ' + l1.initials)
ok(l1.cpf === '52998224725', 'CPF guardado só com dígitos')
await expectError(() => q(`insert into learners (clinic_id, full_name, cpf) values ($1, 'X', '111.111.111-11')`, [C]), 'CPF inválido é recusado')
const [l2] = await q(`insert into learners (clinic_id, full_name) values ($1, 'Davi Exemplo Souza') returning id`, [C])
await q(`insert into learner_team (clinic_id, learner_id, profile_id) values ($1,$2,$3),($1,$2,$4),($1,$5,$4),($1,$5,$6)`,
  [C, l1.id, U.at1, U.sup, l2.id, U.at2])

const [lp] = await q(`insert into learner_programs (clinic_id, learner_id, name) values ($1,$2,'Nomeação de animais') returning id`, [C, l1.id])
const [tg] = await q(`insert into targets (clinic_id, learner_program_id, name, status, current_prompt_level_id) values ($1,$2,'Boi','intervencao',$3) returning id, learner_id`, [C, lp.id, L.AFP])
ok(tg.learner_id === l1.id, 'alvo herda o aprendiz do programa')
const hist0 = await q(`select * from target_prompt_history where target_id = $1`, [tg.id])
ok(hist0.length === 1, 'histórico de nível registrado na criação do alvo')

// --- aplicador 1 ------------------------------------------------------------
console.log('\nAplicador 1 (vinculado só ao Pedro):')
await as(U.at1)
const seen = await q(`select id from learners`)
ok(seen.length === 1 && seen[0].id === l1.id, 'vê só o aprendiz vinculado')
ok((await q(`select id from learners where id = $1`, [l2.id])).length === 0, 'NÃO vê o aprendiz não vinculado')
ok((await q(`select id from targets`)).length === 1, 'vê os alvos do aprendiz dele')
await expectError(() => q(`insert into learner_programs (clinic_id, learner_id, name) values ($1,$2,'X')`, [C, l1.id]), 'não cria programa')
await expectError(() => q(`update profiles set role = 'coordenador' where id = $1`, [U.at1]), 'não muda o próprio papel')
ok((await q(`update targets set name = 'Vaca' where id = $1 returning id`, [tg.id])).length === 0, 'não altera alvo')

const sc = '11111111-1111-1111-1111-111111111111'
const [s1] = await q(`insert into sessions (client_id, clinic_id, learner_id, applicator_id) values ($1,$2,$3,$4) returning id, number`, [sc, C, l1.id, U.at1])
ok(s1.number === 1, 'sessão recebe número #1')
const [s1b] = await q(`insert into sessions (client_id, clinic_id, learner_id, applicator_id, notes) values ($1,$2,$3,$4,'reenvio')
  on conflict (client_id) do update set notes = excluded.notes returning id, number`, [sc, C, l1.id, U.at1])
ok(s1b.id === s1.id && s1b.number === 1, 'reenvio (upsert) não duplica nem gasta número')
await expectError(() => q(`insert into sessions (client_id, clinic_id, learner_id, applicator_id) values (gen_random_uuid(),$1,$2,$3)`, [C, l2.id, U.at1]), 'não cria sessão para aprendiz não vinculado')
await expectError(() => q(`insert into sessions (client_id, clinic_id, learner_id, applicator_id) values (gen_random_uuid(),$1,$2,$3)`, [C, l1.id, U.sup]), 'não cria sessão em nome de outra pessoa')

const results = ['acerto', 'acerto', 'dica', 'erro', 'acerto', 'acerto']
for (const r of results) {
  await q(`insert into trials (client_id, clinic_id, session_id, target_id, learner_id, result, prompt_level_id, help_level_id)
    values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`, [C, s1.id, tg.id, l1.id, r, L.AFP, r === 'dica' ? L.GES : null])
}
const tc = '22222222-2222-2222-2222-222222222222'
await q(`insert into trials (client_id, clinic_id, session_id, target_id, learner_id, result, prompt_level_id) values ($1,$2,$3,$4,$5,'erro',$6)`, [tc, C, s1.id, tg.id, l1.id, L.AFP])
await q(`insert into trials (client_id, clinic_id, session_id, target_id, learner_id, result, prompt_level_id) values ($1,$2,$3,$4,$5,'erro',$6)
  on conflict (client_id) do nothing`, [tc, C, s1.id, tg.id, l1.id, L.AFP])
ok((await q(`select count(*)::int n from trials where session_id = $1`, [s1.id]))[0].n === 7, 'reenvio de tentativa não duplica')
await q(`update trials set deleted_at = now() where client_id = $1`, [tc])
const [stats] = await q(`select * from session_target_stats where session_id = $1`, [s1.id])
ok(Number(stats.trials_total) === 6 && Number(stats.pct_independent) === 66.7, `desfazer não conta: 6 tentativas, ${stats.pct_independent}% independente`)

await q(`update sessions set status = 'finalizada', ended_at = now(), rating = 4 where id = $1`, [s1.id])
ok((await q(`update sessions set notes = 'alterado' where id = $1 returning id`, [s1.id])).length === 0, 'sessão finalizada fica somente leitura para o aplicador')
await expectError(() => q(`insert into trials (client_id, clinic_id, session_id, target_id, learner_id, result) values (gen_random_uuid(),$1,$2,$3,$4,'acerto')`, [C, s1.id, tg.id, l1.id]), 'não adiciona tentativa em sessão finalizada')
await expectError(() => q(`update sessions set deleted_at = now() where id = $1`, [s1.id]).then(r => { if (!r.length) throw new Error('bloqueado por RLS') }), 'não apaga sessão')

// --- aplicador 2 -------------------------------------------------------------
await as(U.at2)
ok((await q(`select id from sessions`)).length === 0, 'aplicador 2 não vê sessões do Pedro')
ok((await q(`select * from session_target_stats`)).length === 0, 'aplicador 2 não vê estatísticas do Pedro (view respeita RLS)')

// --- supervisor ---------------------------------------------------------------
console.log('\nSupervisora:')
await as(U.sup)
ok((await q(`select id from learners`)).length === 2, 'vê os 2 aprendizes vinculados')
ok((await q(`update sessions set notes = 'corrigido pela supervisão' where id = $1 returning id`, [s1.id])).length === 1, 'corrige sessão finalizada')
ok((await q(`select * from session_audit where session_id = $1`, [s1.id])).length === 1, 'correção registrada na auditoria')
await q(`update targets set current_prompt_level_id = $1 where id = $2`, [L.MOD, tg.id])
ok((await q(`select * from target_prompt_history where target_id = $1`, [tg.id])).length === 2, 'mudança de nível registrada no histórico')
await q(`insert into learner_programs (clinic_id, learner_id, name) values ($1,$2,'Imitação')`, [C, l1.id])
ok(true, 'cria programa para aprendiz vinculado')
await expectError(() => q(`insert into learners (clinic_id, full_name) values ($1,'Novo')`, [C]), 'supervisora não cadastra aprendiz')

// maestria: 3 sessões finalizadas ≥80% com ≥5 tentativas
for (let i = 0; i < 3; i++) {
  const [s] = await q(`insert into sessions (client_id, clinic_id, learner_id, applicator_id, started_at) values (gen_random_uuid(),$1,$2,$3, now() + ($4 || ' hours')::interval) returning id`, [C, l1.id, U.sup, String(i + 1)])
  for (let k = 0; k < 5; k++) {
    await q(`insert into trials (client_id, clinic_id, session_id, target_id, learner_id, result) values (gen_random_uuid(),$1,$2,$3,$4,'acerto')`, [C, s.id, tg.id, l1.id])
  }
  await q(`update sessions set status = 'finalizada' where id = $1`, [s.id])
}
const [m] = await q(`select * from target_mastery where target_id = $1`, [tg.id])
ok(m && m.ready_to_master === true, 'alvo fica "Pronto para masterizar" após 3 sessões ≥80%')
const [tgNow] = await q(`select status from targets where id = $1`, [tg.id])
ok(tgNow.status === 'intervencao', 'mas NÃO é masterizado automaticamente')

// --- coordenação --------------------------------------------------------------
console.log('\nCoordenadora:')
await as(U.coord)
ok((await q(`select id from learners`)).length === 2, 'vê todos os aprendizes')
await q(`insert into storage.objects (bucket_id, name) values ('learner-photos', $1)`, [`${C}/${l1.id}/foto.jpg`])
ok(true, 'envia foto do aprendiz para a pasta privada')
await expectError(() => q(`insert into storage.objects (bucket_id, name) values ('learner-photos', $1)`, [`00000000-0000-0000-0000-000000000000/${l1.id}/foto.jpg`]), 'não envia arquivo para pasta de outra clínica')

await as(U.at2)
ok((await q(`select * from storage.objects where bucket_id = 'learner-photos'`)).length === 0, 'aplicador 2 não vê a foto do Pedro')

// --- senha provisória e desativação --------------------------------------------
console.log('\nSenha provisória / desativação:')
await as(U.novo)
ok((await q(`select id from profiles where id = $1`, [U.novo])).length === 1, 'pessoa com senha provisória lê o próprio perfil')
ok((await q(`select id from prompt_levels`)).length === 0, '...mas não lê nenhum dado da clínica')
ok((await q(`select complete_password_change() as r`))[0].r === false, 'não libera sem trocar a senha de fato')
await asAdmin(); await q(`update auth.users set encrypted_password = 'hash-novo' where id = $1`, [U.novo])
await as(U.novo)
ok((await q(`select complete_password_change() as r`))[0].r === true, 'libera depois da troca real')
ok((await q(`select id from prompt_levels`)).length === 7, 'agora lê os dados da clínica')

await asAdmin(); await q(`update profiles set active = false where id = $1`, [U.at1])
await as(U.at1)
ok((await q(`select id from learners`)).length === 0, 'usuário desativado não lê nada na hora')

await as(U.coord)
ok((await q(`select count(*)::int n from cid_codes`))[0].n >= 30, 'CIDs de referência disponíveis')

// --- Fase 2: cadastro de aprendizes (save_learner) ------------------------------
console.log('\nCadastro de aprendizes:')
const cids = (await q(`select id from cid_codes where code in ('F84.0', 'F90.0') order by code`)).map(r => r.id)
const novoAprendiz = {
  full_name: 'Maria Exemplo dos Santos',
  cpf: '111.444.777-35',
  birth_date: '2020-03-14',
  cid_ids: cids,
  team_ids: [U.sup, U.at2, U.at1], // at1 está desativado: não pode entrar
  guardians: [
    { name: 'Joana Exemplo', relationship: 'Mãe', phone: '(11) 98888-0000' },
    { name: 'Carlos Exemplo', relationship: 'Pai' },
  ],
  consent_accepted: true,
}
await expectError(() => q(`select save_learner($1::jsonb)`, [JSON.stringify({ ...novoAprendiz, consent_accepted: false })]), 'não cadastra sem o consentimento LGPD')
const [{ save_learner: lm }] = await q(`select save_learner($1::jsonb)`, [JSON.stringify(novoAprendiz)])
const [lmRow] = await q(`select initials, cpf from learners where id = $1`, [lm])
ok(lmRow.initials === 'MES' && lmRow.cpf === '11144477735', 'cria o aprendiz com iniciais automáticas e CPF só com dígitos')
ok((await q(`select 1 from learner_cids where learner_id = $1 and deleted_at is null`, [lm])).length === 2, 'grava os 2 CIDs')
ok((await q(`select 1 from guardians where learner_id = $1 and deleted_at is null`, [lm])).length === 2, 'grava os 2 responsáveis')
const team = await q(`select profile_id from learner_team where learner_id = $1 and deleted_at is null`, [lm])
ok(team.length === 2 && !team.some(t => t.profile_id === U.at1), 'vincula a equipe, sem o membro desativado')
const cons = await q(`select consent_text, registered_by from consents where learner_id = $1`, [lm])
ok(cons.length === 1 && cons[0].consent_text.startsWith('Declaro que obtive') && cons[0].registered_by === U.coord, 'registra o consentimento com o texto exato e quem registrou')
await expectError(() => q(`select save_learner($1::jsonb)`, [JSON.stringify({ ...novoAprendiz, full_name: 'Outra Exemplo' })]), 'não aceita CPF repetido na clínica')

await as(U.at2)
ok((await q(`select id from learner_overview where id = $1`, [lm])).length === 1, 'AT vinculada passa a ver o novo aprendiz')
await expectError(() => q(`select save_learner($1::jsonb)`, [JSON.stringify({ ...novoAprendiz, cpf: null })]), 'AT não cadastra aprendiz')

await as(U.coord)
const gs = await q(`select id, name from guardians where learner_id = $1 and deleted_at is null order by name`, [lm])
const joana = gs.find(g => g.name === 'Joana Exemplo')
await q(`select save_learner($1::jsonb)`, [JSON.stringify({
  ...novoAprendiz, id: lm, initials: 'MARI', team_ids: [U.sup], cid_ids: [cids[0]],
  guardians: [{ id: joana.id, name: 'Joana Exemplo', relationship: 'Mãe', phone: '(11) 97777-0000' }],
  consent_accepted: false, // já existe: não precisa de novo
})])
ok((await q(`select initials from learners where id = $1`, [lm]))[0].initials === 'MARI', 'edita as iniciais')
ok((await q(`select 1 from learner_cids where learner_id = $1 and deleted_at is null`, [lm])).length === 1, 'remove o CID desmarcado (exclusão lógica)')
const gNow = await q(`select name, phone from guardians where learner_id = $1 and deleted_at is null`, [lm])
ok(gNow.length === 1 && gNow[0].phone === '(11) 97777-0000', 'atualiza um responsável e remove o outro')
ok((await q(`select count(*)::int n from consents where learner_id = $1`, [lm]))[0].n === 1, 'editar não cria novo consentimento')
await as(U.at2)
ok((await q(`select id from learner_overview where id = $1`, [lm])).length === 0, 'AT desvinculada deixa de ver o aprendiz na hora')

await as(U.coord)
const ov = await q(`select full_name, last_session_at, sessions_count from learner_overview where id = $1`, [l1.id])
ok(ov.length === 1 && ov[0].last_session_at !== null && ov[0].sessions_count > 0, 'lista mostra a última sessão do aprendiz')

ok((await q(`select make_initials('Maria (Mari) de Souza') as i`))[0].i === 'MMS', 'iniciais ignoram parênteses e conectivos')

// --- Fase 3: programas ------------------------------------------------------------
console.log('\nProgramas:')
await as(U.sup)
const [{ save_template: tpl }] = await q(`select save_template($1::jsonb)`, [JSON.stringify({
  name: 'Nomeação de cores', objective: 'Nomear cores', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'vbmapp',
  mastery_min_pct: 90, mastery_sessions: 2, mastery_min_trials: 4,
  targets: [{ name: 'Azul' }, { name: 'Vermelho' }, { name: 'Amarelo' }],
})])
ok((await q(`select 1 from template_targets where template_id = $1 and deleted_at is null`, [tpl])).length === 3, 'supervisão cria modelo na biblioteca com 3 alvos sugeridos')
const tts = await q(`select id, name from template_targets where template_id = $1 order by sort_order`, [tpl])
await q(`select save_template($1::jsonb)`, [JSON.stringify({ id: tpl, name: 'Nomeação de cores', targets: [{ id: tts[2].id, name: 'Amarelo' }, { id: tts[0].id, name: 'Azul claro' }] })])
const tts2 = await q(`select name from template_targets where template_id = $1 and deleted_at is null order by sort_order`, [tpl])
ok(tts2.map(t => t.name).join(',') === 'Amarelo,Azul claro', 'editar modelo reordena, renomeia e remove alvos sugeridos')
await q(`insert into program_categories (clinic_id, name) values ($1, 'Linguagem')`, [C])
ok(true, 'supervisão cria pasta na biblioteca')

const [{ create_learner_program: np }] = await q(`select create_learner_program($1::jsonb)`, [JSON.stringify({
  learner_id: l1.id, template_id: tpl, name: 'Nomeação de cores', measure_type: 'tentativa', goal: 'aquisicao',
  mastery_min_pct: 90, mastery_sessions: 2, mastery_min_trials: 4,
  targets: ['Vermelho', 'Azul', 'Verde', 'Amarelo'], start_count: 1, start_level_id: L.MOD,
})])
const nts = await q(`select id, name, status, queue_position, current_prompt_level_id from targets where learner_program_id = $1 order by queue_position`, [np])
ok(nts.length === 4 && nts[0].status === 'intervencao' && nts.slice(1).every(t => t.status === 'fila'), 'cria programa do aprendiz: 1º alvo em intervenção, resto na fila')
ok(nts.every(t => t.current_prompt_level_id === L.MOD), 'alvos começam no nível de ajuda escolhido')
await q(`update program_templates set name = 'Cores (novo nome)' where id = $1`, [tpl])
ok((await q(`select name from learner_programs where id = $1`, [np]))[0].name === 'Nomeação de cores', 'editar o modelo NÃO muda o programa do aprendiz (cópia própria)')

const promoted = (await q(`select set_target_status($1, 'masterizado') as n`, [nts[0].id]))[0].n
const afterMaster = await q(`select id, status, mastered_at from targets where learner_program_id = $1 order by queue_position`, [np])
ok(afterMaster[0].status === 'masterizado' && afterMaster[0].mastered_at, 'masterizar marca o alvo como masterizado')
ok(promoted === nts[1].id && afterMaster[1].status === 'intervencao', 'o próximo da fila entra em intervenção sozinho')
const sh = await q(`select from_status, to_status, changed_by from target_status_history where target_id = $1 order by changed_at`, [nts[0].id])
ok(sh.length === 2 && sh[1].to_status === 'masterizado' && sh[1].changed_by === U.sup, 'histórico registra quem masterizou')

await expectError(() => q(`select set_target_status($1, 'manutencao')`, [nts[1].id]), 'manutenção exige o intervalo de revisão')
await q(`select set_target_status($1, 'manutencao', 7)`, [nts[1].id])
const mt = (await q(`select status, maintenance_interval_days, next_maintenance_date from targets where id = $1`, [nts[1].id]))[0]
ok(mt.status === 'manutencao' && mt.maintenance_interval_days === 7 && mt.next_maintenance_date, 'manutenção guarda o intervalo e a próxima revisão')
ok((await q(`select status from targets where id = $1`, [nts[2].id]))[0].status === 'intervencao', 'ir para manutenção também puxa o próximo da fila')

await q(`select reorder_targets($1, $2::uuid[])`, [np, `{${nts[3].id},${nts[2].id}}`])
ok((await q(`select queue_position from targets where id = $1`, [nts[3].id]))[0].queue_position === 1, 'reordena a fila de alvos')
ok((await q(`select add_targets($1, $2::text[], $3) as n`, [np, '{Rosa,Roxo}', L.AFT]))[0].n === 2, 'adiciona alvos no fim da fila')

const [{ save_playlist: pl }] = await q(`select save_playlist($1::jsonb)`, [JSON.stringify({ learner_id: l1.id, name: 'PDI 2026', program_ids: [np, lp.id] })])
ok((await q(`select 1 from playlist_programs where playlist_id = $1 and deleted_at is null`, [pl])).length === 2, 'cria playlist com 2 programas')
await q(`select save_playlist($1::jsonb)`, [JSON.stringify({ id: pl, learner_id: l1.id, name: 'PDI 2026', program_ids: [np] })])
ok((await q(`select 1 from playlist_programs where playlist_id = $1 and deleted_at is null`, [pl])).length === 1, 'tirar programa da playlist (exclusão lógica)')

const pss = await q(`select * from program_session_stats where learner_program_id = $1`, [lp.id])
ok(pss.length >= 3 && pss.every(r => Number(r.trials_total) > 0), 'desempenho por programa e sessão disponível para os gráficos')

await as(U.at2)
await expectError(() => q(`select set_target_status($1, 'masterizado')`, [nts[2].id]), 'AT não masteriza alvo')
await expectError(() => q(`select create_learner_program($1::jsonb)`, [JSON.stringify({ learner_id: l2.id, name: 'X' })]), 'AT não cria programa')
await expectError(() => q(`select save_template($1::jsonb)`, [JSON.stringify({ name: 'X' })]), 'AT não edita a biblioteca')
ok((await q(`select * from program_session_stats where learner_program_id = $1`, [lp.id])).length === 0, 'AT não vinculada não vê o desempenho do Pedro')

console.log('\nNíveis de ajuda:')
await as(U.sup)
await expectError(() => q(`select save_prompt_levels('[]'::jsonb)`), 'supervisão não altera níveis de ajuda')
await as(U.coord)
const lv = await q(`select id, name, abbreviation, color, is_independent from prompt_levels where deleted_at is null order by sort_order`)
const lvJson = lv.map(({ id, name, abbreviation, color, is_independent }) => ({ id, name, abbreviation, color, is_independent }))
await expectError(() => q(`select save_prompt_levels($1::jsonb)`, [JSON.stringify(lvJson.map(l => ({ ...l, is_independent: false })))]), 'exige exatamente um nível Independente')
await expectError(() => q(`select save_prompt_levels($1::jsonb)`, [JSON.stringify(lvJson.filter(l => l.abbreviation !== 'MOD'))]), 'não remove nível em uso por algum alvo')
const reordered = [lvJson[1], lvJson[0], ...lvJson.slice(2).filter(l => l.abbreviation !== '2OP'), { name: 'Dica visual', abbreviation: 'VIS', color: '#0891b2', is_independent: false }]
await q(`select save_prompt_levels($1::jsonb)`, [JSON.stringify(reordered)])
const lv2 = await q(`select abbreviation from prompt_levels where deleted_at is null order by sort_order`)
ok(lv2.map(l => l.abbreviation).join(',') === 'AFP,AFT,MOD,GES,VER,IND,VIS', 'reordena, remove nível sem uso e adiciona nível novo')

console.log(`\n${pass} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)

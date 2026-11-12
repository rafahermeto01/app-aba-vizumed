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

console.log(`\n${pass} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)

// Cria dados FICTÍCIOS para testar o LovABA (use só no projeto de testes).
//   1 clínica, 1 coordenadora, 1 supervisora, 2 ATs, 4 aprendizes,
//   níveis de ajuda, 10 programas na biblioteca, programas atribuídos,
//   playlists e algumas sessões antigas já finalizadas.
//
// 1. Preencha DEMO_PASSWORD no .env.local (senha das 4 contas de teste, mín. 8 caracteres)
// 2. Rode:  npm run seed:demo
import { adminClient, check, fail, requireEnv, step } from './_lib.ts'

const DEMO_CLINIC = 'Clínica Demonstração LovABA'
const password = requireEnv('DEMO_PASSWORD')
if (password.length < 8) fail('DEMO_PASSWORD precisa ter pelo menos 8 caracteres.')

const sb = adminClient()

const already = check(
  await sb.from('clinics').select('id').eq('name', DEMO_CLINIC).maybeSingle(),
  'Erro ao verificar a clínica demo',
)
if (already) fail('Os dados de demonstração já existem. Nada foi alterado.')

// --- Clínica (os 7 níveis de ajuda são criados automaticamente) -------------
step('Criando a clínica de demonstração…')
const clinic = check(await sb.from('clinics').insert({ name: DEMO_CLINIC }).select('id').single(), 'Clínica')
const C = clinic.id as string
const levels = check(
  await sb.from('prompt_levels').select('id, abbreviation').eq('clinic_id', C).order('sort_order'),
  'Níveis de ajuda',
) as { id: string; abbreviation: string }[]
const level = (abbr: string) => levels.find((l) => l.abbreviation === abbr)!.id

// --- Equipe -------------------------------------------------------------------
const team = [
  { key: 'coord', name: 'Carla Coordenadora (demo)', email: 'coordenadora@demo.lovaba.test', role: 'coordenador' },
  { key: 'sup', name: 'Sofia Supervisora (demo)', email: 'supervisora@demo.lovaba.test', role: 'supervisor' },
  { key: 'ana', name: 'Ana AT (demo)', email: 'ana.at@demo.lovaba.test', role: 'aplicador' },
  { key: 'bruno', name: 'Bruno AT (demo)', email: 'bruno.at@demo.lovaba.test', role: 'aplicador' },
] as const
const P: Record<string, string> = {}

step('Criando a equipe de teste…')
for (const m of team) {
  const res = await sb.auth.admin.createUser({
    email: m.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: m.name },
  })
  if (res.error || !res.data.user) fail(`Login ${m.email}: ${res.error?.message}`)
  P[m.key] = res.data.user.id
  check(
    await sb.from('profiles').insert({
      id: res.data.user.id,
      clinic_id: C,
      full_name: m.name,
      email: m.email,
      role: m.role,
      must_change_password: false,
    }),
    `Perfil ${m.email}`,
  )
}

// --- Biblioteca: pastas e 10 programas ---------------------------------------
step('Criando a biblioteca de programas…')
const categoryNames = ['Imitação', 'Linguagem receptiva', 'Linguagem expressiva', 'Habilidades de aprendiz', 'Comportamento']
const categories = check(
  await sb.from('program_categories').insert(categoryNames.map((name, i) => ({ clinic_id: C, name, sort_order: i }))).select('id, name'),
  'Pastas',
) as { id: string; name: string }[]
const cat = (name: string) => categories.find((c) => c.name === name)!.id

type Tpl = {
  name: string
  objective: string
  procedure: string
  measure_type: 'tentativa' | 'frequencia' | 'duracao'
  goal: 'aquisicao' | 'reducao'
  protocol: string | null
  category: string
  targets: string[]
}
const templates: Tpl[] = [
  { name: 'Imitação motora grossa', objective: 'Imitar ações motoras grossas após o modelo do terapeuta.', procedure: 'Dizer "Faz assim" e realizar a ação. Aguardar até 5 segundos.', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'vbmapp', category: 'Imitação', targets: ['Bater palmas', 'Levantar os braços', 'Tocar a cabeça', 'Bater os pés'] },
  { name: 'Contato visual sob demanda', objective: 'Olhar para o rosto do terapeuta ao ser chamado pelo nome.', procedure: 'Chamar pelo nome a 1 metro de distância. Considerar acerto o olhar em até 3 segundos.', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'ablls_r', category: 'Habilidades de aprendiz', targets: ['Chamado pelo nome', 'Chamado a 2 metros'] },
  { name: 'Nomeação de animais (tato)', objective: 'Nomear figuras de animais.', procedure: 'Apresentar a figura e perguntar "O que é?".', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'vbmapp', category: 'Linguagem expressiva', targets: ['Boi', 'Gato', 'Cachorro', 'Pato', 'Cavalo'] },
  { name: 'Seguir instruções de um passo', objective: 'Seguir instruções simples sem gestos.', procedure: 'Dar a instrução uma vez, sem apontar.', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'denver_esdm', category: 'Linguagem receptiva', targets: ['Senta', 'Vem cá', 'Pega a bola', 'Guarda o brinquedo'] },
  { name: 'Identificar cores', objective: 'Entregar o objeto da cor pedida entre 3 opções.', procedure: 'Dispor 3 objetos e pedir "Me dá o ___".', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'ablls_r', category: 'Linguagem receptiva', targets: ['Vermelho', 'Azul', 'Amarelo', 'Verde'] },
  { name: 'Pareamento de figuras idênticas', objective: 'Parear figuras idênticas em campo de 3.', procedure: 'Entregar a figura e dizer "Coloca igual".', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'vbmapp', category: 'Habilidades de aprendiz', targets: ['Frutas', 'Meios de transporte', 'Objetos da casa'] },
  { name: 'Mando por itens preferidos', objective: 'Pedir itens preferidos com palavra ou figura.', procedure: 'Mostrar o item fora do alcance e aguardar o pedido.', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'peak', category: 'Linguagem expressiva', targets: ['Bola', 'Bolha de sabão', 'Biscoito'] },
  { name: 'Ecoico de sílabas', objective: 'Repetir sílabas simples após o modelo.', procedure: 'Dizer "Fala ___" e aguardar 3 segundos.', measure_type: 'tentativa', goal: 'aquisicao', protocol: 'marcos_cv', category: 'Linguagem expressiva', targets: ['Pa', 'Ma', 'Bo', 'Té'] },
  { name: 'Redução de fugas da mesa', objective: 'Reduzir saídas da mesa durante a atividade.', procedure: 'Registrar cada vez que a criança se levanta e sai da mesa sem permissão.', measure_type: 'frequencia', goal: 'reducao', protocol: null, category: 'Comportamento', targets: ['Fuga da mesa'] },
  { name: 'Tempo sentado à mesa', objective: 'Aumentar o tempo sentado em atividade dirigida.', procedure: 'Cronometrar do início da atividade até a criança se levantar.', measure_type: 'duracao', goal: 'aquisicao', protocol: 'afls', category: 'Habilidades de aprendiz', targets: ['Atividade de mesa'] },
]

const tplRows: { id: string; tpl: Tpl }[] = []
for (const t of templates) {
  const row = check(
    await sb
      .from('program_templates')
      .insert({
        clinic_id: C,
        name: t.name,
        objective: t.objective,
        procedure: t.procedure,
        measure_type: t.measure_type,
        goal: t.goal,
        protocol: t.protocol,
        category_id: cat(t.category),
        created_by: P.sup,
      })
      .select('id')
      .single(),
    `Programa ${t.name}`,
  )
  check(
    await sb.from('template_targets').insert(t.targets.map((name, i) => ({ clinic_id: C, template_id: row.id, name, sort_order: i }))),
    `Alvos de ${t.name}`,
  )
  tplRows.push({ id: row.id, tpl: t })
}

// --- Aprendizes (nomes inventados, com "Exemplo") -----------------------------
step('Criando os aprendizes fictícios…')
const cids = check(await sb.from('cid_codes').select('id, code').is('clinic_id', null), 'CIDs') as { id: string; code: string }[]
const cid = (code: string) => cids.find((c) => c.code === code)!.id
const CONSENT =
  'Declaro que obtive o consentimento informado do responsável pelo(a) aprendiz para a coleta, armazenamento e uso de dados sensíveis, incluindo fotos, em conformidade com a LGPD.'

const learners = [
  { name: 'Pedro Exemplo Silva', birth: '2020-03-14', cids: ['F84.0'], guardian: ['Mariana Exemplo Silva', 'Mãe'], team: ['sup', 'ana'], programs: [0, 2, 3, 8] },
  { name: 'Laura Exemplo Costa', birth: '2019-08-02', cids: ['F84.0', 'F80.1'], guardian: ['Ricardo Exemplo Costa', 'Pai'], team: ['sup', 'ana'], programs: [1, 4, 6, 9] },
  { name: 'Davi Exemplo Souza', birth: '2021-01-25', cids: ['F84.9'], guardian: ['Juliana Exemplo Souza', 'Mãe'], team: ['sup', 'bruno'], programs: [0, 5, 7] },
  { name: 'Alice Exemplo Lima', birth: '2018-11-09', cids: ['F84.0', 'F90.0'], guardian: ['Helena Exemplo Lima', 'Avó'], team: ['sup', 'bruno'], programs: [2, 3, 8, 9] },
]

const now = Date.now()
const DAY = 86_400_000
const rand = (seed: number) => {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

for (const [li, l] of learners.entries()) {
  const learner = check(
    await sb.from('learners').insert({ clinic_id: C, full_name: l.name, birth_date: l.birth, created_by: P.coord }).select('id').single(),
    `Aprendiz ${l.name}`,
  )
  const L = learner.id as string
  check(await sb.from('learner_cids').insert(l.cids.map((c) => ({ clinic_id: C, learner_id: L, cid_code_id: cid(c) }))), 'CIDs do aprendiz')
  const guardian = check(
    await sb
      .from('guardians')
      .insert({ clinic_id: C, learner_id: L, name: l.guardian[0], relationship: l.guardian[1], phone: '(11) 90000-000' + li, email: `responsavel${li + 1}@demo.lovaba.test` })
      .select('id')
      .single(),
    'Responsável',
  )
  check(
    await sb.from('consents').insert({ clinic_id: C, learner_id: L, guardian_id: guardian.id, consent_text: CONSENT, registered_by: P.coord }),
    'Consentimento',
  )
  check(await sb.from('learner_team').insert(l.team.map((k) => ({ clinic_id: C, learner_id: L, profile_id: P[k] }))), 'Equipe do aprendiz')

  // Programas atribuídos (cópia do modelo) + alvos: o 1º em intervenção, os demais na fila.
  const assigned: { lpId: string; tpl: Tpl; targets: { id: string; level: string | null }[] }[] = []
  for (const [order, idx] of l.programs.entries()) {
    const { id: templateId, tpl } = tplRows[idx]
    const lp = check(
      await sb
        .from('learner_programs')
        .insert({
          clinic_id: C,
          learner_id: L,
          template_id: templateId,
          name: tpl.name,
          objective: tpl.objective,
          procedure: tpl.procedure,
          measure_type: tpl.measure_type,
          goal: tpl.goal,
          protocol: tpl.protocol,
          category_name: tpl.category,
          sort_order: order,
          created_by: P.sup,
        })
        .select('id')
        .single(),
      `Programa ${tpl.name} de ${l.name}`,
    )
    const isTrial = tpl.measure_type === 'tentativa'
    const startLevel = isTrial ? level(['AFP', 'MOD', 'GES', 'VER'][(li + order) % 4]) : null
    const rows = tpl.targets.map((name, i) => ({
      clinic_id: C,
      learner_program_id: lp.id,
      learner_id: L,
      name,
      queue_position: i,
      status: i <= 1 ? 'intervencao' : 'fila', // os 2 primeiros em treino
      current_prompt_level_id: isTrial && i <= 1 ? startLevel : null,
      created_by: P.sup,
    }))
    const targets = check(await sb.from('targets').insert(rows).select('id, status, current_prompt_level_id'), 'Alvos') as {
      id: string
      status: string
      current_prompt_level_id: string | null
    }[]
    assigned.push({ lpId: lp.id, tpl, targets: targets.filter((t) => t.status === 'intervencao').map((t) => ({ id: t.id, level: t.current_prompt_level_id })) })
  }

  const playlist = check(
    await sb.from('playlists').insert({ clinic_id: C, learner_id: L, name: 'PDI 2026', created_by: P.sup }).select('id').single(),
    'Playlist',
  )
  check(
    await sb.from('playlist_programs').insert(assigned.map((a, i) => ({ clinic_id: C, playlist_id: playlist.id, learner_program_id: a.lpId, sort_order: i }))),
    'Programas da playlist',
  )

  // Sessões antigas já finalizadas (para os gráficos terem dados).
  const applicator = P[l.team[1]]
  const r = rand(li + 7)
  for (let s = 0; s < 6; s++) {
    const started = new Date(now - (12 - s * 2) * DAY + 14 * 3_600_000)
    const durationMin = 40 + Math.round(r() * 20)
    const session = check(
      await sb
        .from('sessions')
        .insert({
          client_id: crypto.randomUUID(),
          clinic_id: C,
          learner_id: L,
          applicator_id: applicator,
          started_at: started.toISOString(),
          created_by: applicator,
        })
        .select('id')
        .single(),
      'Sessão',
    )
    check(
      await sb.from('session_programs').insert(assigned.map((a) => ({ clinic_id: C, client_id: crypto.randomUUID(), session_id: session.id, learner_program_id: a.lpId }))),
      'Programas da sessão',
    )
    const trials: Record<string, unknown>[] = []
    let t = started.getTime()
    for (const a of assigned) {
      for (const target of a.targets) {
        if (a.tpl.measure_type === 'tentativa') {
          const pPlus = 0.35 + s * 0.09 // melhora ao longo das sessões
          for (let k = 0; k < 8; k++) {
            const x = r()
            const result = x < pPlus ? 'acerto' : x < pPlus + 0.35 ? 'dica' : 'erro'
            t += 20_000
            trials.push({
              client_id: crypto.randomUUID(),
              clinic_id: C,
              session_id: session.id,
              target_id: target.id,
              learner_id: L,
              result,
              prompt_level_id: target.level,
              help_level_id: result === 'dica' ? target.level : null,
              recorded_at: new Date(t).toISOString(),
              created_by: applicator,
            })
          }
        } else if (a.tpl.measure_type === 'frequencia') {
          const n = Math.max(0, 6 - s + Math.round(r() * 2))
          for (let k = 0; k < n; k++) {
            t += 60_000
            trials.push({ client_id: crypto.randomUUID(), clinic_id: C, session_id: session.id, target_id: target.id, learner_id: L, value: 1, recorded_at: new Date(t).toISOString(), created_by: applicator })
          }
        } else {
          for (let k = 0; k < 2; k++) {
            const secs = 60 + s * 25 + Math.round(r() * 40)
            const st = t
            t += secs * 1000
            trials.push({ client_id: crypto.randomUUID(), clinic_id: C, session_id: session.id, target_id: target.id, learner_id: L, value: secs, started_at: new Date(st).toISOString(), recorded_at: new Date(t).toISOString(), created_by: applicator })
          }
        }
      }
    }
    check(await sb.from('trials').insert(trials), 'Tentativas')
    check(
      await sb
        .from('sessions')
        .update({
          status: 'finalizada',
          ended_at: new Date(started.getTime() + durationMin * 60_000).toISOString(),
          duration_seconds: durationMin * 60,
          rating: 3 + Math.round(r() * 2),
          notes: 'Sessão de demonstração. Criança colaborativa, boa resposta aos reforçadores.',
        })
        .eq('id', session.id),
      'Finalizar sessão',
    )
  }
}

console.log('\n✔ Dados de demonstração criados. Contas de teste (senha = DEMO_PASSWORD):')
for (const m of team) console.log(`   ${m.role.padEnd(12)} ${m.email}`)
console.log('')

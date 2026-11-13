// Revisão automática de acessibilidade (WCAG 2.1 A/AA) com axe-core, num
// Chrome de verdade, em todas as telas principais — no celular e no computador.
//   npm run test:a11y      (usa o projeto Supabase de TESTES e o Chrome instalado)
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { chromium } from 'playwright-core'
import { build, preview } from 'vite'

config({ path: '.env.local', quiet: true })
const { VITE_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: SERVICE, DEMO_PASSWORD } = process.env
const require = createRequire(import.meta.url)
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(
  (p) => p && existsSync(p),
)

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const pedro = (await admin.from('learners').select('id').eq('full_name', 'Pedro Exemplo Silva').single()).data
const program = (await admin.from('learner_programs').select('id').eq('learner_id', pedro.id).eq('name', 'Nomeação de animais (tato)').single()).data
const session = (await admin.from('sessions').select('id').eq('learner_id', pedro.id).eq('status', 'finalizada').is('deleted_at', null).order('started_at', { ascending: false }).limit(1).single()).data
const template = (await admin.from('program_templates').select('id').is('deleted_at', null).limit(1).single()).data

const root = path.resolve(import.meta.dirname, '../..')
await build({ root, logLevel: 'warn' })
const server = await preview({ root, preview: { port: 4180, strictPort: true }, logLevel: 'warn' })
const BASE = 'http://localhost:4180'

const PAGES = [
  ['Início', '/'],
  ['Aprendizes', '/aprendizes'],
  ['Aprendiz · Programas', `/aprendizes/${pedro.id}?aba=programas`],
  ['Aprendiz · Sessões', `/aprendizes/${pedro.id}?aba=sessoes`],
  ['Aprendiz · Desempenho', `/aprendizes/${pedro.id}?aba=desempenho`],
  ['Aprendiz · Cadastro', `/aprendizes/${pedro.id}?aba=cadastro`],
  ['Cadastrar aprendiz', '/aprendizes/novo'],
  ['Programa · Alvos', `/aprendizes/${pedro.id}/programas/${program.id}`],
  ['Programa · Evolução', `/aprendizes/${pedro.id}/programas/${program.id}?aba=evolucao`],
  ['Programa · Histórico', `/aprendizes/${pedro.id}/programas/${program.id}?aba=historico`],
  ['Detalhe da sessão', `/aprendizes/${pedro.id}/sessoes/${session.id}`],
  ['Biblioteca', '/biblioteca'],
  ['Modelo da biblioteca', `/biblioteca/${template.id}`],
  ['Configurações · Clínica', '/configuracoes'],
  ['Configurações · Equipe', '/configuracoes?aba=equipe'],
  ['Configurações · CIDs', '/configuracoes?aba=cids'],
  ['Configurações · Níveis', '/configuracoes?aba=niveis'],
  ['Meu perfil', '/perfil'],
  ['Coleta · selecionar programas', `/aprendizes/${pedro.id}/sessao/nova`],
]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
let total = 0
let testSession = null
const cspErrors = []
const seen = new Map()

async function scan(page, name) {
  // injeta o axe pelo canal do próprio navegador (a política de segurança bloqueia scripts injetados na página)
  await page.evaluate(AXE_SOURCE)
  const res = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => n.html.slice(0, 160) + (n.any?.[0]?.message ? '  ⇒ ' + n.any[0].message.slice(0, 140) : '')) }))
  })
  for (const v of res) {
    total++
    const key = v.id
    const entry = seen.get(key) ?? { ...v, pages: [] }
    entry.pages.push(name)
    seen.set(key, entry)
  }
  console.log(`  ${res.length ? '✖' : '✔'} ${name}${res.length ? ` — ${res.map((v) => v.id).join(', ')}` : ''}`)
}

try {
  for (const [label, viewport] of [
    ['celular', { width: 390, height: 844 }],
    ['computador', { width: 1280, height: 860 }],
  ]) {
    console.log(`\n• ${label}`)
    const ctx = await browser.newContext({ viewport, locale: 'pt-BR' })
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) cspErrors.push(m.text().slice(0, 200))
    })
    await page.goto(`${BASE}/login`)
    await scan(page, 'Login')
    await page.getByLabel('E-mail').fill('coordenadora@demo.lovaba.test')
    await page.getByLabel('Senha').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${BASE}/`)
    for (const [name, url] of PAGES) {
      await page.goto(`${BASE}${url}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(600)
      await scan(page, name)
    }
    if (label === 'celular') {
      // Telas da coleta: abre uma sessão de teste (apagada no final)
      await page.goto(`${BASE}/aprendizes/${pedro.id}/sessao/nova`)
      await page.getByRole('tab', { name: 'Todos' }).click()
      const box = page.getByRole('checkbox', { name: /Imitação motora grossa/ })
      if (!(await box.isChecked())) await box.click()
      await page.getByRole('button', { name: /Ver resumo/ }).click()
      await scan(page, 'Coleta · confirmar')
      await page.getByRole('button', { name: 'Registrar', exact: true }).click()
      await page.waitForURL(/\/sessao\/[0-9a-f-]{36}$/)
      testSession = page.url().split('/').pop()
      await page.getByRole('button', { name: /Acerto independente em / }).first().click()
      await page.waitForTimeout(500)
      await scan(page, 'Coleta · registrar')
      await page.getByRole('button', { name: 'Finalizar' }).click()
      await page.waitForTimeout(800)
      await scan(page, 'Coleta · finalizar')
    }
    await ctx.close()
  }
} finally {
  if (testSession) await admin.from('sessions').update({ deleted_at: new Date().toISOString() }).eq('id', testSession)
  await browser.close()
  await new Promise((r) => server.httpServer.close(r))
}

if (seen.size) {
  console.log('\nProblemas encontrados:')
  for (const v of seen.values()) {
    console.log(`- [${v.impact}] ${v.id}: ${v.help}`)
    console.log(`    telas: ${[...new Set(v.pages)].join(', ')}`)
    for (const n of v.nodes) console.log(`      ${n}`)
  }
}
const NL = String.fromCharCode(10)
if (cspErrors.length) console.log(`${NL}✖ A política de segurança (CSP) bloqueou algo do app:${NL}  ${[...new Set(cspErrors)].join(NL + '  ')}`)
else console.log(`${NL}✔ Nenhum bloqueio da política de segurança (CSP) nas telas do app.`)
console.log(total ? `${NL}✖ ${total} problema(s) de acessibilidade.${NL}` : `${NL}✔ Nenhum problema de acessibilidade encontrado (WCAG 2.1 A/AA).${NL}`)
process.exit(total || cspErrors.length ? 1 : 0)

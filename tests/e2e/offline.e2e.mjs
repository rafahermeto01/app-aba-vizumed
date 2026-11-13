// Teste de ponta a ponta da coleta SEM INTERNET (seção 8 da especificação),
// num Chrome de verdade, contra o projeto Supabase de TESTES:
//   1. entra como a AT fictícia e abre uma sessão (com internet)
//   2. DESLIGA a internet e registra tentativas
//   3. RECARREGA a página sem internet (o app abre pelo cache e retoma a sessão)
//   4. finaliza a sessão (assinatura) ainda sem internet
//   5. LIGA a internet e confere no banco: tudo chegou, sem duplicar
//
// Rode:  npm run test:offline   (usa o Chrome instalado no computador)
import { existsSync } from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { chromium } from 'playwright-core'
import { build, preview } from 'vite'

config({ path: '.env.local', quiet: true })
const { VITE_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: SERVICE, DEMO_PASSWORD } = process.env
if (!URL_ || !SERVICE || !DEMO_PASSWORD) {
  console.error('\n✖ Preencha VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DEMO_PASSWORD no .env.local\n')
  process.exit(1)
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p))
if (!CHROME) {
  console.error('\n✖ Chrome não encontrado. Informe o caminho em CHROME_PATH.\n')
  process.exit(1)
}

let failures = 0
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✔' : '✖'} ${msg}`)
  if (!cond) failures++
}
const step = (m) => console.log(`\n• ${m}`)

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const pedro = (await admin.from('learners').select('id').eq('full_name', 'Pedro Exemplo Silva').single()).data
const laura = (await admin.from('learners').select('id').eq('full_name', 'Laura Exemplo Costa').single()).data
if (!pedro || !laura) {
  console.error('\n✖ Aprendiz demo "Pedro" não encontrado. Rode "npm run seed:demo".\n')
  process.exit(1)
}

step('Gerando a versão instalável do app (build + PWA)…')
const root = path.resolve(import.meta.dirname, '../..')
await build({ root, logLevel: 'warn' })
const server = await preview({ root, preview: { port: 4179, strictPort: true }, logLevel: 'warn' })
const BASE = 'http://localhost:4179'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const page = await context.newPage()
page.on('dialog', (d) => void d.accept()) // "sair da página?" ao recarregar
let sessionId

try {
  step('Entrando como a AT fictícia (com internet)')
  await page.goto(`${BASE}/login`)
  await page.getByLabel('E-mail').fill('ana.at@demo.lovaba.test')
  await page.getByLabel('Senha').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.evaluate(() => navigator.serviceWorker.ready)
  ok(true, 'login feito e app instalado no navegador (service worker ativo)')
  await page.waitForTimeout(6000) // o app baixa em segundo plano os aprendizes da AT para uso offline

  // Fecha alguma sessão de teste antiga deste aparelho (não deve haver: navegador novo)
  step('Abrindo a sessão do Pedro')
  await page.goto(`${BASE}/aprendizes/${pedro.id}/sessao/nova`)
  await page.getByRole('button', { name: /Ver resumo/ }).click()
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await page.waitForURL(/\/sessao\/[0-9a-f-]{36}$/)
  sessionId = page.url().split('/').pop()
  await page.getByText('Salvo', { exact: true }).waitFor({ timeout: 15000 })
  ok(true, `sessão aberta e enviada ao servidor (${sessionId.slice(0, 8)}…)`)
  await page.waitForTimeout(1500) // deixa a cópia das telas ser guardada no aparelho

  step('DESLIGANDO a internet e registrando tentativas')
  await context.setOffline(true)
  const plus = page.getByRole('button', { name: 'Acerto independente em Bater palmas' })
  const minus = page.getByRole('button', { name: 'Erro em Bater palmas' })
  await plus.click()
  await plus.click()
  await page.getByRole('button', { name: 'Acerto com dica em Bater palmas' }).click()
  await page.getByRole('button', { name: /^Confirmar/ }).click()
  await minus.click()
  await minus.click()
  await page.getByRole('button', { name: 'Desfazer última marcação' }).click() // toque errado
  await page.getByRole('button', { name: 'Mais uma ocorrência de Fuga da mesa' }).click()
  await page.getByText('Sem internet, salvo no aparelho').first().waitFor({ timeout: 5000 })
  ok(true, 'indicador mostra “Sem internet, salvo no aparelho”')
  const seq1 = await page.getByLabel(/^Tentativas:/).first().getAttribute('aria-label')
  ok(seq1 === 'Tentativas: + + D −', `tentativas na tela: ${seq1}`)

  step('RECARREGANDO a página ainda sem internet')
  await page.reload()
  await page.getByLabel(/^Tentativas:/).first().waitFor({ timeout: 15000 })
  const seq2 = await page.getByLabel(/^Tentativas:/).first().getAttribute('aria-label')
  ok(seq2 === seq1, 'o app abriu sem internet e retomou a sessão exatamente de onde parou')
  ok((await page.getByText('ocorrência', { exact: true }).count()) === 1, 'contador de frequência preservado (1 ocorrência)')

  step('Finalizando a sessão ainda sem internet')
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await page.getByRole('radio', { name: /Bom/ }).click()
  await page.getByPlaceholder('Registro de evolução diária').fill('[teste automático offline] Sessão fictícia.')
  const canvas = page.getByLabel('Quadro para assinatura')
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + 30, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, box.y + 140, { steps: 8 })
  await page.mouse.move(box.x + 260, box.y + 50, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Finalizar', exact: true }).last().click()
  await page.waitForURL(/\/resumo$/)
  ok((await page.getByText('acerto independente').count()) > 0, 'resumo da sessão aparece mesmo sem internet')

  // Nada pode ter chegado ao servidor ainda
  const before = await admin.from('trials').select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
  ok(before.count === 0, 'sem internet, nada saiu do aparelho (0 tentativas no servidor)')

  step('LIGANDO a internet')
  await context.setOffline(false)
  await page.getByText('Salvo', { exact: true }).waitFor({ timeout: 30000 })
  ok(true, 'indicador voltou para “Salvo”')

  const s = (await admin.from('sessions').select('status, rating, notes, applicator_signature_path, number').eq('id', sessionId).single()).data
  const trials = (await admin.from('trials').select('client_id, result, value, deleted_at, help_level_id').eq('session_id', sessionId)).data ?? []
  const sig = await admin.storage.from('signatures').list(`${s?.applicator_signature_path?.split('/')[0]}/${sessionId}`)
  ok(s?.status === 'finalizada' && s.rating === 4, `sessão finalizada no servidor (Sessão #${s?.number})`)
  ok(trials.length === 6, `6 registros no servidor (+ + DICA − − e 1 ocorrência) (encontrados: ${trials.length})`)
  ok(new Set(trials.map((t) => t.client_id)).size === trials.length, 'nenhum registro duplicado')
  ok(trials.filter((t) => t.deleted_at).length === 1, 'o toque desfeito chegou marcado como desfeito')
  ok(trials.filter((t) => t.result === 'dica' && t.help_level_id).length === 1, 'a DICA chegou com a ajuda usada')
  ok((sig.data ?? []).some((f) => f.name === 'aplicador.png'), 'assinatura guardada na pasta privada')

  step('Reabrindo o app (força reenviar o que estiver na fila)')
  await page.reload()
  await page.getByText('Salvo', { exact: true }).waitFor({ timeout: 15000 })
  const again = await admin.from('trials').select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
  ok(again.count === 6, 'depois de reabrir, continua sem duplicar')

  step('Abrindo o app JÁ SEM INTERNET e começando uma sessão da Laura (baixada em segundo plano)')
  await context.setOffline(true)
  await page.goto(`${BASE}/`)
  await page.getByText(/Boa (noite|tarde|dia)/).first().waitFor({ timeout: 15000 })
  ok(true, 'o app abriu sem internet')
  await page.goto(`${BASE}/aprendizes/${laura.id}/sessao/nova`)
  await page.getByRole('button', { name: /Ver resumo/ }).click()
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await page.waitForURL(/\/sessao\/[0-9a-f-]{36}$/)
  const lauraSession = page.url().split('/').pop()
  const firstPlus = page.getByRole('button', { name: /^Acerto independente em / }).first()
  await firstPlus.click()
  await firstPlus.click()
  await page.getByRole('button', { name: 'Finalizar' }).click()
  const c2 = page.getByLabel('Quadro para assinatura')
  await c2.scrollIntoViewIfNeeded()
  const b2 = await c2.boundingBox()
  await page.mouse.move(b2.x + 40, b2.y + 60)
  await page.mouse.down()
  await page.mouse.move(b2.x + 220, b2.y + 120, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Finalizar', exact: true }).last().click()
  await page.waitForURL(/\/resumo$/)
  ok(true, 'sessão inteira feita sem internet (início, tentativas, assinatura)')
  await context.setOffline(false)
  await page.getByText('Salvo', { exact: true }).waitFor({ timeout: 30000 })
  const ls = (await admin.from('sessions').select('status, number').eq('id', lauraSession).single()).data
  const lt = await admin.from('trials').select('id', { count: 'exact', head: true }).eq('session_id', lauraSession)
  ok(ls?.status === 'finalizada' && lt.count === 2, `ao voltar a internet, a sessão da Laura chegou completa (Sessão #${ls?.number}, ${lt.count} tentativas)`)
} catch (e) {
  failures++
  console.error('\n✖ Erro no teste:', e.message)
  await page.screenshot({ path: path.join(root, 'tests/e2e/falha-offline.png') }).catch(() => undefined)
  console.error('  (captura de tela salva em tests/e2e/falha-offline.png)')
} finally {
  await browser.close()
  await new Promise((r) => server.httpServer.close(r))
}

console.log(failures ? `\n✖ ${failures} verificação(ões) falharam.\n` : '\n✔ Coleta sem internet funcionando: nada perdido, nada duplicado.\n')
process.exit(failures ? 1 : 0)

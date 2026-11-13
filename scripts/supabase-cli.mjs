// Roda a ferramenta do Supabase (CLI) usando a chave deste projeto
// (SUPABASE_ACCESS_TOKEN do .env.local), sem depender do login global do
// computador — que outros projetos podem trocar.
//   node scripts/supabase-cli.mjs db push --remote
//
// Com --prod: usa o arquivo .env.producao.local e aponta o "--remote" direto
// para o projeto de PRODUÇÃO (o endereço sai de VITE_SUPABASE_URL desse arquivo).
//   node scripts/supabase-cli.mjs --prod db push --remote
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

import { config } from 'dotenv'

const args = process.argv.slice(2)
const prod = args[0] === '--prod'
const envFile = prod ? '.env.producao.local' : '.env.local'
if (prod) args.shift()
if (!existsSync(envFile)) {
  console.error(`\n✖ Arquivo ${envFile} não encontrado. Veja o README (seção "Publicar para uso real").\n`)
  process.exit(1)
}
config({ path: envFile, quiet: true, override: true })

if (prod) {
  const ref = (process.env.VITE_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  if (!ref) {
    console.error(`\n✖ Preencha VITE_SUPABASE_URL (https://xxxx.supabase.co) em ${envFile}.\n`)
    process.exit(1)
  }
  for (let i = 0; i < args.length; i++) if (args[i] === '--remote') args[i] = `--remote=${ref}`
  console.log(`• Projeto de PRODUÇÃO: ${ref}`)
}

// Chama o programa direto pelo Node (sem passar pelo terminal), para que
// argumentos com espaços (ex.: uma consulta SQL) cheguem inteiros.
const require = createRequire(import.meta.url)
const cli = require.resolve('supabase/dist/supabase.js')
const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env: process.env })
process.exit(result.status ?? 1)

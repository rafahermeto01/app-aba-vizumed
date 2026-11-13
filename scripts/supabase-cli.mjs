// Roda a ferramenta do Supabase (CLI) usando a chave deste projeto
// (SUPABASE_ACCESS_TOKEN do .env.local), sem depender do login global do
// computador — que outros projetos podem trocar.
//   node scripts/supabase-cli.mjs db push --remote
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

// Chama o programa direto pelo Node (sem passar pelo terminal), para que
// argumentos com espaços (ex.: uma consulta SQL) cheguem inteiros.
const require = createRequire(import.meta.url)
const cli = require.resolve('supabase/dist/supabase.js')
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env })
process.exit(result.status ?? 1)

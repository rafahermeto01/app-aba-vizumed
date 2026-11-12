// Roda a ferramenta do Supabase (CLI) usando a chave deste projeto
// (SUPABASE_ACCESS_TOKEN do .env.local), sem depender do login global do
// computador — que outros projetos podem trocar.
//   node scripts/supabase-cli.mjs db push --remote
import { spawnSync } from 'node:child_process'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const result = spawnSync('npx', ['supabase', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})
process.exit(result.status ?? 1)

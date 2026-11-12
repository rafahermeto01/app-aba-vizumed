// Cria a clínica e o(a) primeiro(a) Coordenador(a). Roda UMA vez.
//
// 1. Preencha no .env.local:
//      FIRST_ADMIN_EMAIL, FIRST_ADMIN_PASSWORD, FIRST_ADMIN_NAME
//      (opcional) FIRST_CLINIC_NAME
// 2. Rode:  npm run admin:create
//
// As credenciais ficam só no .env.local (que nunca vai para o GitHub).
import { adminClient, check, fail, requireEnv, step } from './_lib.ts'

const email = requireEnv('FIRST_ADMIN_EMAIL').toLowerCase()
const password = requireEnv('FIRST_ADMIN_PASSWORD')
const fullName = requireEnv('FIRST_ADMIN_NAME')
const clinicName = process.env.FIRST_CLINIC_NAME?.trim() || 'Minha Clínica'

if (password.length < 8) {
  fail('FIRST_ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.')
}

const sb = adminClient()

const existing = check(
  await sb.from('profiles').select('id').eq('email', email).maybeSingle(),
  'Erro ao verificar usuários existentes',
)
if (existing) {
  fail(`Já existe um usuário com o e-mail ${email}. Nada foi alterado.`)
}

step(`Criando a clínica "${clinicName}"…`)
const clinic = check(
  await sb.from('clinics').insert({ name: clinicName }).select('id').single(),
  'Erro ao criar a clínica',
)

step('Criando o login…')
const created = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
})
if (created.error || !created.data.user) {
  await sb.from('prompt_levels').delete().eq('clinic_id', clinic.id)
  await sb.from('clinics').delete().eq('id', clinic.id)
  fail(`Erro ao criar o login: ${created.error?.message ?? 'desconhecido'}`)
}
const userId = created.data.user.id

step('Criando o perfil de Coordenador(a)…')
const profile = await sb.from('profiles').insert({
  id: userId,
  clinic_id: clinic.id,
  full_name: fullName,
  email,
  role: 'coordenador',
  must_change_password: false, // a senha foi escolhida por você
})
if (profile.error) {
  await sb.auth.admin.deleteUser(userId)
  await sb.from('prompt_levels').delete().eq('clinic_id', clinic.id)
  await sb.from('clinics').delete().eq('id', clinic.id)
  fail(`Erro ao criar o perfil: ${profile.error.message}`)
}

console.log(`\n✔ Pronto! Entre no LovABA com o e-mail ${email}.`)
console.log('  Por segurança, apague FIRST_ADMIN_PASSWORD do .env.local agora.\n')

// Testa as pastas privadas de fotos no projeto de TESTES:
// a coordenação envia a foto de um aprendiz; quem é vinculado consegue abrir;
// quem NÃO é vinculado não consegue nem gerar o link. Apaga a foto no final.
//
// Rode:  npm run test:fotos
import { fail, publicClient, requireEnv } from './_lib.ts'

const password = requireEnv('DEMO_PASSWORD')
let failures = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? '✔' : '✖'} ${msg}`)
  if (!cond) failures++
}

async function login(email: string) {
  const sb = publicClient()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) fail(`login ${email}: ${error.message}. Você rodou "npm run seed:demo"?`)
  return sb
}

const coord = await login('coordenadora@demo.lovaba.test')
const ana = await login('ana.at@demo.lovaba.test') // vinculada ao Pedro
const bruno = await login('bruno.at@demo.lovaba.test') // NÃO vinculado ao Pedro

const pedro = (await coord.from('learners').select('id, clinic_id').eq('full_name', 'Pedro Exemplo Silva').single()).data
if (!pedro) fail('Aprendiz demo "Pedro" não encontrado.')

// PNG de 1x1 pixel
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const path = `${pedro.clinic_id}/${pedro.id}/teste-${Date.now()}.png`

const up = await coord.storage.from('learner-photos').upload(path, png, { contentType: 'image/png' })
ok(!up.error, 'coordenação envia a foto do aprendiz para a pasta privada')

const anaUrl = await ana.storage.from('learner-photos').createSignedUrl(path, 60)
ok(Boolean(anaUrl.data?.signedUrl), 'AT vinculada consegue abrir a foto (link temporário)')
if (anaUrl.data?.signedUrl) {
  const res = await fetch(anaUrl.data.signedUrl)
  ok(res.ok, 'o link temporário funciona')
}

const brunoUrl = await bruno.storage.from('learner-photos').createSignedUrl(path, 60)
ok(!brunoUrl.data?.signedUrl, 'AT NÃO vinculada não consegue abrir a foto')

const anaUp = await ana.storage.from('learner-photos').upload(`${pedro.clinic_id}/${pedro.id}/intrusa.png`, png, { contentType: 'image/png' })
ok(Boolean(anaUp.error), 'AT não consegue enviar foto de aprendiz')

const publicUrl = coord.storage.from('learner-photos').getPublicUrl(path).data.publicUrl
const pub = await fetch(publicUrl)
ok(!pub.ok, 'a foto NÃO abre por link público (pasta privada)')

await coord.storage.from('learner-photos').remove([path])
await Promise.all([coord.auth.signOut(), ana.auth.signOut(), bruno.auth.signOut()])

console.log(failures ? `\n✖ ${failures} verificação(ões) falharam.\n` : '\n✔ Fotos protegidas corretamente.\n')
process.exit(failures ? 1 : 0)

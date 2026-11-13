// Testa o "cofre" do aparelho + fila de sincronização com um servidor falso
// (que se comporta como o banco: upsert por client_id, ordem obrigatória).
import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { LovabaDB, type SnapshotProgram } from '@/offline/db'
import { createOps } from '@/offline/ops'
import { createSyncEngine, RemoteError, type Remote } from '@/offline/sync'

const USER = 'user-ana'
const PROGRAMS: SnapshotProgram[] = [
  {
    id: 'prog-animais',
    name: 'Nomeação de animais',
    goal: 'aquisicao',
    measure_type: 'tentativa',
    targets: [
      { id: 'alvo-boi', name: 'Boi', phase: 'intervencao', level_id: 'lvl-mod' },
      { id: 'alvo-gato', name: 'Gato', phase: 'intervencao', level_id: 'lvl-afp' },
    ],
  },
  { id: 'prog-fugas', name: 'Fugas', goal: 'reducao', measure_type: 'frequencia', targets: [{ id: 'alvo-fuga', name: 'Fuga', phase: 'intervencao', level_id: null }] },
]

/** Servidor falso: tabelas em memória indexadas pelo client_id (como o banco real). */
function fakeServer() {
  const sessions = new Map<string, Record<string, unknown>>()
  const sessionPrograms = new Map<string, Record<string, unknown>>()
  const trials = new Map<string, Record<string, unknown>>()
  const signatures = new Set<string>()
  const log: string[] = []
  let offline = false
  let counter = 0
  let hook: ((kind: string, payload: Record<string, unknown>) => Promise<void> | void) | null = null

  const net = () => {
    if (offline) throw new RemoteError('network', 'Failed to fetch')
  }
  const remote: Remote = {
    async upsertSession(p) {
      net()
      const existing = sessions.get(String(p.client_id))
      if (existing?.status === 'finalizada') throw new RemoteError('rejected', 'sessão finalizada')
      const number = existing ? (existing.number as number) : ++counter
      sessions.set(String(p.client_id), { ...existing, ...p, number, status: existing?.status ?? 'em_andamento' })
      log.push('session')
      return { number }
    },
    async upsertSessionProgram(p) {
      net()
      if (!sessions.has(String(p.session_id))) throw new RemoteError('rejected', 'FK sessão')
      sessionPrograms.set(String(p.client_id), p)
      log.push('session_program')
    },
    async upsertTrial(p) {
      net()
      await hook?.('trial', p)
      const s = sessions.get(String(p.session_id))
      if (!s) throw new RemoteError('rejected', 'FK sessão')
      if (s.status === 'finalizada') throw new RemoteError('rejected', 'sessão finalizada: não aceita tentativas')
      trials.set(String(p.client_id), p)
      log.push('trial')
    },
    async uploadSignature(path) {
      net()
      signatures.add(path)
      log.push('signature')
    },
    async finalizeSession(p) {
      net()
      const s = sessions.get(String(p.id))
      if (!s) throw new RemoteError('rejected', 'sessão não existe')
      sessions.set(String(p.id), { ...s, ...p, status: 'finalizada' })
      log.push('finalize')
    },
  }
  return {
    remote,
    sessions,
    sessionPrograms,
    trials,
    signatures,
    log,
    setOffline: (v: boolean) => (offline = v),
    setHook: (h: typeof hook) => (hook = h),
  }
}

function setup(dbName: string, server: ReturnType<typeof fakeServer>) {
  const db = new LovabaDB(dbName)
  const ops = createOps(db)
  const engine = createSyncEngine({ db, remote: server.remote, getUserId: () => USER, isOnline: () => true, ignoreBackoff: true })
  return { db, ops, engine }
}

async function start(ops: ReturnType<typeof createOps>) {
  return ops.startSession({
    user_id: USER,
    clinic_id: 'clinica',
    learner_id: 'pedro',
    learner_name: 'Pedro Exemplo',
    learner_initials: 'PE',
    applicator_name: 'Ana',
    programs: PROGRAMS,
    levels: [],
  })
}

describe('coleta sem internet', () => {
  it('registra offline, sobrevive a recarregar, sincroniza ao voltar e não duplica', async () => {
    const server = fakeServer()
    const name = 'teste-offline-1'
    let { db, ops, engine } = setup(name, server)

    // 1. Sem internet desde o início
    server.setOffline(true)
    const session = await start(ops)
    await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-boi', result: 'acerto' })
    await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-boi', result: 'acerto' })
    await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-boi', result: 'dica', help_level_id: 'lvl-afp' })
    await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-gato', result: 'erro' })
    await ops.recordTrial({ session, program_id: 'prog-fugas', target_id: 'alvo-fuga', value: 1 })
    await ops.undoLast(session.id) // toque errado na fuga
    const r1 = await engine.sync()
    expect(r1.stoppedOffline).toBe(true)
    expect(server.trials.size).toBe(0)

    // 2. "Recarrega a página": novo acesso ao mesmo banco do aparelho
    db.close()
    ;({ db, ops, engine } = setup(name, server))
    const resumed = await db.sessions.get(session.id)
    expect(resumed?.status).toBe('em_andamento')
    expect(await db.trials.where('session_id').equals(session.id).count()).toBe(5)
    expect((await db.trials.where('session_id').equals(session.id).toArray()).filter((t) => !t.deleted_at)).toHaveLength(4)

    // 3. Volta a internet: tudo chega, na ordem certa
    server.setOffline(false)
    const r2 = await engine.sync()
    expect(r2.pending).toBe(0)
    expect(server.sessions.size).toBe(1)
    expect(server.sessionPrograms.size).toBe(2)
    expect(server.trials.size).toBe(5)
    expect([...server.trials.values()].filter((t) => t.deleted_at).length).toBe(1) // o desfeito chega marcado
    expect(server.log.indexOf('session')).toBeLessThan(server.log.indexOf('trial'))
    expect((await db.sessions.get(session.id))?.number).toBe(1) // Sessão #1 voltou do servidor
    const dica = [...server.trials.values()].find((t) => t.result === 'dica')
    expect(dica?.prompt_level_id).toBe('lvl-mod') // foto do nível atual do alvo
    expect(dica?.help_level_id).toBe('lvl-afp') // ajuda usada de fato

    // 4. Reenvio (resposta perdida): nada duplica
    for (const t of await db.trials.toArray()) await server.remote.upsertTrial({ ...t, client_id: t.id })
    expect(server.trials.size).toBe(5)
    db.close()
  })

  it('finaliza depois de todas as tentativas, mesmo que tudo tenha sido feito offline', async () => {
    const server = fakeServer()
    const { db, ops, engine } = setup('teste-offline-2', server)
    server.setOffline(true)
    const session = await start(ops)
    await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-boi', result: 'acerto' })
    await ops.updateSession(session.id, { notes: 'Pedro participou bem.' })
    await ops.startTimer(session.id, 'alvo-fuga')
    const fin = await ops.finalizeSession(session.id, { rating: 4, notes: 'Pedro participou bem.', signature_data_url: 'data:image/png;base64,AAAA' })
    expect(fin.status).toBe('finalizada')
    await expect(ops.updateSession(session.id, { notes: 'x' })).rejects.toThrow() // somente leitura

    server.setOffline(false)
    const r = await engine.sync()
    expect(r.pending).toBe(0)
    const s = [...server.sessions.values()][0]
    expect(s.status).toBe('finalizada')
    expect(s.rating).toBe(4)
    expect(s.notes).toBe('Pedro participou bem.')
    expect(server.trials.size).toBe(2) // tentativa + cronômetro esquecido rodando
    expect(server.log.lastIndexOf('trial')).toBeLessThan(server.log.indexOf('signature'))
    expect(server.log.indexOf('signature')).toBeLessThan(server.log.indexOf('finalize'))
    db.close()
  })

  it('não perde uma alteração feita enquanto o envio estava acontecendo', async () => {
    const server = fakeServer()
    const { db, ops, engine } = setup('teste-offline-3', server)
    const session = await start(ops)
    const t = await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-boi', result: 'acerto' })
    // Enquanto a tentativa está "no caminho", a terapeuta toca em Desfazer
    let undone = false
    server.setHook(async () => {
      if (!undone) {
        undone = true
        await ops.undoTrial(t.id)
      }
    })
    await engine.sync()
    expect(await db.outbox.count()).toBe(1) // a versão desfeita continua na fila
    server.setHook(null)
    await engine.sync()
    expect(server.trials.get(t.id)?.deleted_at).toBeTruthy()
    expect(await db.outbox.count()).toBe(0)
    db.close()
  })

  it('recusa do servidor: guarda o erro, não apaga nada e não envia o resto daquela sessão', async () => {
    const server = fakeServer()
    const { db, ops, engine } = setup('teste-offline-4', server)
    const session = await start(ops)
    await ops.recordTrial({ session, program_id: 'prog-animais', target_id: 'alvo-boi', result: 'acerto' })
    const realUpsert = server.remote.upsertSession
    server.remote.upsertSession = async () => {
      throw new RemoteError('rejected', '42501 sem permissão')
    }
    const r = await engine.sync()
    expect(r.failed).toBe(1)
    expect(r.pending).toBeGreaterThan(0)
    expect(server.trials.size).toBe(0) // nada fora de ordem
    expect(await db.trials.count()).toBe(1) // dado continua no aparelho
    server.remote.upsertSession = realUpsert
    const r2 = await engine.sync()
    expect(r2.pending).toBe(0)
    expect(server.trials.size).toBe(1)
    db.close()
  })
})

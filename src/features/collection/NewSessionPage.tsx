import { ArrowLeft, CirclePlay, History, ListMusic, NotebookPen, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { GOAL_LABEL, MEASURE_SHORT } from '@/features/programs/constants'
import { PromptLevelBadge } from '@/features/programs/PromptLevelBadge'
import { usePromptLevels } from '@/features/programs/usePromptLevels'
import { useTeam } from '@/features/team/api'
import { timeAgo } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ops } from '@/offline'
import { useOpenSessions } from '@/offline/hooks'

import { collectibleTargets, toSnapshot, useCollectionBundle, type BundleProgram } from './api'
import { Shell } from './Shell'

type Filter = 'todos' | 'ultima' | 'meus' | 'playlists'

function phaseSummary(p: BundleProgram) {
  const ts = collectibleTargets(p)
  const iv = ts.filter((t) => t.phase === 'intervencao').length
  const mt = ts.filter((t) => t.phase === 'manutencao').length
  const parts = [iv && `${iv} em intervenção`, mt && `${mt} em manutenção`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sem alvos para coletar hoje'
}

/** Passos 2 (selecionar programas) e 3 (confirmar). */
export function NewSessionPage() {
  const { id: learnerId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const bundle = useCollectionBundle(learnerId)
  const levels = usePromptLevels()
  const team = useTeam()
  const open = useOpenSessions(profile?.id, learnerId)
  const [filter, setFilter] = useState<Filter>('todos')
  const [selected, setSelected] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)
  const [step, setStep] = useState<'selecionar' | 'confirmar'>('selecionar')
  const [starting, setStarting] = useState(false)

  const data = bundle.data
  const who = useMemo(() => new Map((team.data ?? []).map((m) => [m.id, m.full_name])), [team.data])

  // Pré-seleciona o que foi aplicado na última sessão
  useEffect(() => {
    if (!data || initialized) return
    setInitialized(true)
    if (data.lastSession?.program_ids.length) {
      const ids = data.programs.filter((p) => data.lastSession!.program_ids.includes(p.id) && collectibleTargets(p).length).map((p) => p.id)
      if (ids.length) {
        setSelected(ids)
        setFilter('ultima')
      }
    }
  }, [data, initialized])

  const visible = useMemo(() => {
    if (!data) return []
    if (filter === 'meus') return data.programs.filter((p) => data.programApplicators[p.id]?.includes(profile?.id ?? ''))
    return data.programs
  }, [data, filter, profile?.id])

  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)))
  const chosen = (data?.programs ?? []).filter((p) => selected.includes(p.id))

  async function start(withPrograms: BundleProgram[]) {
    if (!profile || !data) return
    setStarting(true)
    try {
      const session = await ops.startSession({
        user_id: profile.id,
        clinic_id: data.learner.clinic_id,
        learner_id: data.learner.id,
        learner_name: data.learner.full_name,
        learner_initials: data.learner.initials,
        applicator_name: profile.full_name,
        programs: withPrograms.map(toSnapshot),
        levels: levels.active.map(({ id, name, abbreviation, color, sort_order, is_independent }) => ({ id, name, abbreviation, color, sort_order, is_independent })),
      })
      navigate(`/sessao/${session.id}`, { replace: true })
    } catch {
      toast.error('Não foi possível iniciar a sessão no aparelho. Tente de novo.')
      setStarting(false)
    }
  }

  const back = (
    <Button asChild variant="ghost" className="-ml-3">
      <Link to={`/aprendizes/${learnerId}?aba=sessoes`}>
        <ArrowLeft aria-hidden /> Voltar
      </Link>
    </Button>
  )

  if (bundle.isPending) {
    return (
      <Shell back={back} title="Registrar sessão">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell back={back} title="Registrar sessão">
        <Card>
          <CardContent className="py-8 text-center text-base text-muted-foreground">
            Os programas deste aprendiz ainda não estão neste aparelho. Conecte-se à internet uma vez para baixá-los.
          </CardContent>
        </Card>
      </Shell>
    )
  }

  if (open.length > 0) {
    const s = open[0]
    return (
      <Shell back={back} title="Registrar sessão" subtitle={data.learner.full_name}>
        <Card>
          <CardContent className="flex flex-col gap-4 py-2">
            <p className="text-base">
              Você já tem uma sessão em andamento com {data.learner.initials}, iniciada {timeAgo(s.started_at)}.
            </p>
            <Button size="lg" onClick={() => navigate(`/sessao/${s.id}`)}>
              <CirclePlay aria-hidden /> Continuar a sessão
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  // ---- Passo 3: confirmação ----
  if (step === 'confirmar') {
    return (
      <Shell
        back={
          <Button variant="ghost" className="-ml-3" onClick={() => setStep('selecionar')}>
            <ArrowLeft aria-hidden /> Escolher programas
          </Button>
        }
        title="Pronto para registrar a sessão?"
        subtitle={`${data.learner.full_name} · ${chosen.length} ${chosen.length === 1 ? 'programa' : 'programas'}`}
        footer={
          <Button size="lg" className="h-14 w-full text-lg" onClick={() => void start(chosen)} disabled={starting}>
            <CirclePlay aria-hidden /> {starting ? 'Iniciando…' : 'Registrar'}
          </Button>
        }
      >
        <ul className="flex flex-col gap-3">
          {chosen.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-medium">{p.name}</p>
                    <Badge variant="secondary">{GOAL_LABEL[p.goal]}</Badge>
                    <Badge variant="outline">{MEASURE_SHORT[p.measure_type]}</Badge>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {collectibleTargets(p).map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-base">
                        {p.measure_type === 'tentativa' && <PromptLevelBadge level={t.level_id ? levels.byId.get(t.level_id) : undefined} className="h-6" />}
                        <span>{t.name}</span>
                        {t.phase === 'manutencao' && <Badge variant="outline">Manutenção</Badge>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">O cronômetro começa quando você tocar em Registrar.</p>
      </Shell>
    )
  }

  // ---- Passo 2: selecionar programas ----
  return (
    <Shell
      back={back}
      title="Selecionar programas"
      subtitle={data.learner.full_name}
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" className="h-14 w-full text-lg" disabled={chosen.length === 0} onClick={() => setStep('confirmar')}>
            Ver resumo ({chosen.length} {chosen.length === 1 ? 'programa' : 'programas'})
          </Button>
          <Button variant="ghost" onClick={() => void start([])} disabled={starting}>
            <NotebookPen aria-hidden /> Registrar sem programas (só notas)
          </Button>
        </div>
      }
    >
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filtros">
        {(
          [
            ['todos', 'Todos', null],
            ['ultima', 'Última sessão', History],
            ['meus', 'Meus programas', UserRound],
            ['playlists', 'Playlists', ListMusic],
          ] as const
        ).map(([value, label, Icon]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={filter === value}
            variant={filter === value ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => {
              setFilter(value)
              if (value === 'ultima' && data.lastSession) {
                setSelected(data.programs.filter((p) => data.lastSession!.program_ids.includes(p.id) && collectibleTargets(p).length).map((p) => p.id))
              }
            }}
          >
            {Icon && <Icon aria-hidden />} {label}
          </Button>
        ))}
      </div>

      {filter === 'ultima' && (
        <p className="text-sm text-muted-foreground">
          {data.lastSession
            ? `Programas da última sessão (${timeAgo(data.lastSession.started_at)}, com ${who.get(data.lastSession.applicator_id) ?? 'outra pessoa'}) já vêm marcados.`
            : 'Ainda não há sessões anteriores.'}
        </p>
      )}

      {filter === 'playlists' && (
        <div className="flex flex-col gap-2">
          {data.playlists.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhuma playlist para este aprendiz.</p>
          ) : (
            data.playlists.map((pl) => (
              <Button
                key={pl.id}
                variant="outline"
                size="lg"
                className="justify-start"
                onClick={() => {
                  setSelected(pl.program_ids.filter((id) => data.programs.some((p) => p.id === id && collectibleTargets(p).length)))
                  toast.success(`Playlist “${pl.name}” selecionada.`)
                }}
              >
                <ListMusic aria-hidden /> {pl.name}
                <span className="ml-auto text-sm text-muted-foreground">{pl.program_ids.length} programas</span>
              </Button>
            ))
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-base text-muted-foreground">
          {filter === 'meus' ? 'Você ainda não aplicou programas com este aprendiz.' : 'Nenhum programa ativo.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((p) => {
            const can = collectibleTargets(p).length > 0
            const last = data.programLast[p.id]
            const inputId = `sel-${p.id}`
            return (
              <li key={p.id}>
                <label
                  htmlFor={inputId}
                  className={cn(
                    'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-card p-3',
                    selected.includes(p.id) && 'border-primary bg-primary/5',
                    !can && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Checkbox id={inputId} checked={selected.includes(p.id)} disabled={!can} onCheckedChange={(c) => toggle(p.id, c === true)} className="size-6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-base font-medium">{p.name}</span>
                      <Badge variant="secondary">{GOAL_LABEL[p.goal]}</Badge>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{phaseSummary(p)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {last ? `Aplicado ${timeAgo(last.at)} por ${who.get(last.applicator_id) ?? 'outra pessoa'}` : 'Ainda não aplicado'}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Shell>
  )
}

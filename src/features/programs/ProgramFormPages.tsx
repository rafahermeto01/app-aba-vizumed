import { ArrowLeft, BookOpen, ChevronRight, FilePlus2, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { useUnsavedGuard } from '@/components/UnsavedChangesGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormError } from '@/features/auth/AuthCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { FullScreenLoader } from '@/features/auth/RequireAuth'
import { useLearner } from '@/features/learners/api'
import { useCategories, useTemplate, useTemplates, type TemplateDetail } from '@/features/library/api'
import { friendlyError } from '@/lib/errors'

import { canManageLearner, useCreateProgram, useProgram, useProgramStats, useUpdateProgram, type ProgramDetail } from './api'
import { DEFAULT_MASTERY, GOAL_LABEL, MEASURE_SHORT } from './constants'
import {
  DescriptionFields,
  emptyDescription,
  FieldRow,
  MasteryFields,
  masteryError,
  TargetListEditor,
  type Mastery,
  type ProgramDescription,
  type TargetDraft,
} from './ProgramFields'
import { PromptLevelBadge } from './PromptLevelBadge'
import { usePromptLevels } from './usePromptLevels'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription className="text-base">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

function NoAccess({ learnerId }: { learnerId?: string }) {
  return (
    <>
      <PageHeader title="Sem permissão" description="Só a coordenação e a supervisão vinculada ao aprendiz alteram os programas." />
      <Button asChild variant="outline">
        <Link to={learnerId ? `/aprendizes/${learnerId}?aba=programas` : '/aprendizes'}>Voltar</Link>
      </Button>
    </>
  )
}

// ---- Novo programa -------------------------------------------------------------------

export function NewProgramPage() {
  const { id: learnerId } = useParams()
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const learner = useLearner(learnerId)
  const templateId = params.get('modelo')
  const fromScratch = params.get('modo') === 'zero'
  const template = useTemplate(templateId ?? undefined)

  if (learner.isPending || (templateId && template.isPending)) return <FullScreenLoader />
  if (!learner.data || !canManageLearner(profile, learner.data)) return <NoAccess learnerId={learnerId} />

  if (!templateId && !fromScratch) {
    return <PickTemplate learnerId={learner.data.id} learnerName={learner.data.full_name} onPick={(id) => setParams(id ? { modelo: id } : { modo: 'zero' })} />
  }
  return <NewProgramForm key={templateId ?? 'zero'} learnerId={learner.data.id} learnerName={learner.data.full_name} template={template.data ?? null} />
}

function PickTemplate({ learnerId, learnerName, onPick }: { learnerId: string; learnerName: string; onPick: (templateId: string | null) => void }) {
  const templates = useTemplates()
  const [search, setSearch] = useState('')
  const list = useMemo(() => {
    const q = norm(search.trim())
    return (templates.data ?? []).filter((t) => !q || norm(`${t.name} ${t.objective ?? ''}`).includes(q))
  }, [templates.data, search])

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link to={`/aprendizes/${learnerId}?aba=programas`}>
          <ArrowLeft aria-hidden /> {learnerName}
        </Link>
      </Button>
      <PageHeader title="Novo programa" description="Escolha um modelo da biblioteca ou crie do zero." />
      <div className="flex max-w-3xl flex-col gap-4">
        <Button variant="outline" size="lg" className="justify-start" onClick={() => onPick(null)}>
          <FilePlus2 aria-hidden /> Criar do zero
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar na biblioteca" className="pl-10" aria-label="Buscar modelo" />
        </div>
        {templates.isPending ? (
          <p className="text-base text-muted-foreground">Carregando biblioteca…</p>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <BookOpen className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-base text-muted-foreground">Nenhum modelo encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onPick(t.id)} className="w-full rounded-xl text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex items-center gap-3 py-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium">{t.name}</p>
                        {t.objective && <p className="line-clamp-1 text-sm text-muted-foreground">{t.objective}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{GOAL_LABEL[t.goal]}</Badge>
                          <Badge variant="outline">{MEASURE_SHORT[t.measure_type]}</Badge>
                          <Badge variant="outline">{t.targets_count === 1 ? "1 alvo" : `${t.targets_count} alvos`}</Badge>
                        </div>
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function NewProgramForm({ learnerId, learnerName, template }: { learnerId: string; learnerName: string; template: TemplateDetail | null }) {
  const navigate = useNavigate()
  const create = useCreateProgram()
  const levels = usePromptLevels()
  const categories = useCategories()
  const categoryName = template?.category_id ? (categories.data ?? []).find((c) => c.id === template.category_id)?.name ?? '' : ''

  const [desc, setDesc] = useState<ProgramDescription>(
    template
      ? {
          name: template.name,
          objective: template.objective ?? '',
          procedure: template.procedure ?? '',
          measure_type: template.measure_type,
          goal: template.goal,
          protocol: template.protocol ?? '',
          protocol_other: template.protocol_other ?? '',
        }
      : emptyDescription(),
  )
  const [area, setArea] = useState<string | null>(null)
  const [mastery, setMastery] = useState<Mastery>(
    template ? { mastery_min_pct: template.mastery_min_pct, mastery_sessions: template.mastery_sessions, mastery_min_trials: template.mastery_min_trials } : DEFAULT_MASTERY,
  )
  const [targets, setTargets] = useState<TargetDraft[]>(template?.targets.map((t) => ({ key: t.id, name: t.name })) ?? [])
  const [startCount, setStartCount] = useState(1)
  const [startLevel, setStartLevel] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const guard = useUnsavedGuard(dirty)

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }
  const level = startLevel ?? levels.active[0]?.id ?? null
  const validTargets = targets.filter((t) => t.name.trim())
  const maxStart = Math.max(validTargets.length, 0)
  const start = Math.min(startCount, maxStart)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNameError(undefined)
    if (!desc.name.trim()) return setNameError('Informe o nome do programa.')
    const mErr = masteryError(mastery)
    if (mErr) return setError(mErr)
    try {
      const id = await create.mutateAsync({
        learner_id: learnerId,
        template_id: template?.id ?? null,
        ...desc,
        category_name: (area ?? categoryName).trim(),
        ...mastery,
        targets: validTargets.map((t) => t.name.trim()),
        start_count: start,
        start_level_id: desc.measure_type === 'tentativa' ? level : null,
      })
      setDirty(false)
      guard.allowLeave()
      toast.success('Programa criado.')
      navigate(`/aprendizes/${learnerId}/programas/${id}`, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link to={`/aprendizes/${learnerId}/programas/novo`}>
          <ArrowLeft aria-hidden /> Escolher outro modelo
        </Link>
      </Button>
      <PageHeader
        title={template ? `Atribuir “${template.name}”` : 'Novo programa'}
        description={`Para ${learnerName}. O programa vira uma cópia própria: mudar o modelo da biblioteca depois não altera este programa.`}
      />
      <form onSubmit={(e) => void submit(e)} className="flex max-w-3xl flex-col gap-6" noValidate>
        <Section title="Descrição">
          <DescriptionFields
            value={desc}
            onChange={touch(setDesc)}
            nameError={nameError}
            extra={
              <FieldRow id="np-area" label="Área (opcional)" hint="Ex.: Linguagem, Imitação.">
                <Input id="np-area" value={area ?? categoryName} onChange={(e) => touch(setArea)(e.target.value)} autoComplete="off" />
              </FieldRow>
            }
          />
        </Section>

        <Section title="Alvos" description="Na ordem da fila. Os primeiros começam em intervenção; os outros esperam na fila.">
          <TargetListEditor value={targets} onChange={touch(setTargets)} />
          {validTargets.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <FieldRow id="np-start" label="Começar em intervenção">
                <Select value={String(start)} onValueChange={(v) => touch(setStartCount)(Number(v))}>
                  <SelectTrigger id="np-start" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxStart + 1 }, (_, n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'Nenhum (todos na fila)' : n === 1 ? 'O 1º alvo' : `Os ${n} primeiros alvos`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              {desc.measure_type === 'tentativa' && (
                <FieldRow id="np-level" label="Nível de ajuda inicial">
                  <Select value={level ?? ''} onValueChange={touch(setStartLevel)}>
                    <SelectTrigger id="np-level" className="w-full">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.active.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          <PromptLevelBadge level={l} showName />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              )}
            </div>
          )}
        </Section>

        <Section title="Critério de maestria">
          <MasteryFields value={mastery} onChange={touch(setMastery)} measure={desc.measure_type} goal={desc.goal} />
        </Section>

        <FormError message={error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" size="lg">
            <Link to={`/aprendizes/${learnerId}?aba=programas`}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={create.isPending}>
            {create.isPending ? 'Salvando…' : 'Criar programa'}
          </Button>
        </div>
      </form>
      {guard.dialog}
    </>
  )
}

// ---- Editar programa -----------------------------------------------------------------

export function EditProgramPage() {
  const { id: learnerId, programId } = useParams()
  const { profile } = useAuth()
  const learner = useLearner(learnerId)
  const program = useProgram(programId)
  if (learner.isPending || program.isPending) return <FullScreenLoader />
  if (!learner.data || !program.data || !canManageLearner(profile, learner.data)) return <NoAccess learnerId={learnerId} />
  return <EditProgramForm key={program.data.id} program={program.data} />
}

function EditProgramForm({ program }: { program: ProgramDetail }) {
  const navigate = useNavigate()
  const update = useUpdateProgram(program.learner_id, program.id)
  const stats = useProgramStats(program.learner_id)
  const hasSessions = (stats.data ?? []).some((s) => s.learner_program_id === program.id)

  const [desc, setDesc] = useState<ProgramDescription>({
    name: program.name,
    objective: program.objective ?? '',
    procedure: program.procedure ?? '',
    measure_type: program.measure_type,
    goal: program.goal,
    protocol: program.protocol ?? '',
    protocol_other: program.protocol_other ?? '',
  })
  const [area, setArea] = useState(program.category_name ?? '')
  const [mastery, setMastery] = useState<Mastery>({
    mastery_min_pct: program.mastery_min_pct,
    mastery_sessions: program.mastery_sessions,
    mastery_min_trials: program.mastery_min_trials,
  })
  const [nameError, setNameError] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const guard = useUnsavedGuard(dirty)
  const back = `/aprendizes/${program.learner_id}/programas/${program.id}`

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNameError(undefined)
    if (!desc.name.trim()) return setNameError('Informe o nome do programa.')
    const mErr = masteryError(mastery)
    if (mErr) return setError(mErr)
    try {
      await update.mutateAsync({
        name: desc.name.trim(),
        objective: desc.objective.trim() || null,
        procedure: desc.procedure.trim() || null,
        measure_type: desc.measure_type,
        goal: desc.goal,
        protocol: desc.protocol || null,
        protocol_other: desc.protocol === 'outro' ? desc.protocol_other.trim() || null : null,
        category_name: area.trim() || null,
        ...mastery,
      })
      setDirty(false)
      guard.allowLeave()
      toast.success('Programa atualizado.')
      navigate(back)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link to={back}>
          <ArrowLeft aria-hidden /> {program.name}
        </Link>
      </Button>
      <PageHeader title="Editar programa" description="Os alvos são ajustados na página do programa." />
      <form onSubmit={(e) => void submit(e)} className="flex max-w-3xl flex-col gap-6" noValidate>
        <Section title="Descrição">
          <DescriptionFields
            value={desc}
            onChange={touch(setDesc)}
            nameError={nameError}
            lockMeasure={hasSessions}
            extra={
              <FieldRow id="ep-area" label="Área (opcional)">
                <Input id="ep-area" value={area} onChange={(e) => touch(setArea)(e.target.value)} autoComplete="off" />
              </FieldRow>
            }
          />
        </Section>
        <Section title="Critério de maestria">
          <MasteryFields value={mastery} onChange={touch(setMastery)} measure={desc.measure_type} goal={desc.goal} />
        </Section>
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" size="lg">
            <Link to={back}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
      {guard.dialog}
    </>
  )
}

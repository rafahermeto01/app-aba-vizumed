import { Archive, ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { useUnsavedGuard } from '@/components/UnsavedChangesGuard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormError } from '@/features/auth/AuthCard'
import { FullScreenLoader } from '@/features/auth/RequireAuth'
import { DEFAULT_MASTERY } from '@/features/programs/constants'
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
} from '@/features/programs/ProgramFields'
import { friendlyError } from '@/lib/errors'

import { useArchiveTemplate, useCategories, useSaveTemplate, useTemplate, type TemplateDetail } from './api'

export function TemplateFormPage() {
  const { id } = useParams()
  const template = useTemplate(id)
  if (id && template.isPending) return <FullScreenLoader />
  if (id && !template.data) {
    return (
      <>
        <PageHeader title="Modelo não encontrado" />
        <Button asChild variant="outline">
          <Link to="/biblioteca">Voltar para a biblioteca</Link>
        </Button>
      </>
    )
  }
  return <TemplateForm key={id ?? 'novo'} initial={template.data ?? null} />
}

const NO_FOLDER = 'sem-pasta'

function TemplateForm({ initial }: { initial: TemplateDetail | null }) {
  const navigate = useNavigate()
  const categories = useCategories()
  const save = useSaveTemplate()
  const archive = useArchiveTemplate()

  const [desc, setDesc] = useState<ProgramDescription>(
    initial
      ? {
          name: initial.name,
          objective: initial.objective ?? '',
          procedure: initial.procedure ?? '',
          measure_type: initial.measure_type,
          goal: initial.goal,
          protocol: initial.protocol ?? '',
          protocol_other: initial.protocol_other ?? '',
        }
      : emptyDescription(),
  )
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? NO_FOLDER)
  const [mastery, setMastery] = useState<Mastery>(
    initial ? { mastery_min_pct: initial.mastery_min_pct, mastery_sessions: initial.mastery_sessions, mastery_min_trials: initial.mastery_min_trials } : DEFAULT_MASTERY,
  )
  const [targets, setTargets] = useState<TargetDraft[]>(initial?.targets.map((t) => ({ key: t.id, id: t.id, name: t.name })) ?? [])
  const [tab, setTab] = useState('descricao')
  const [dirty, setDirty] = useState(false)
  const [nameError, setNameError] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const guard = useUnsavedGuard(dirty)

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNameError(undefined)
    if (!desc.name.trim()) {
      setNameError('Informe o nome do programa.')
      setTab('descricao')
      return
    }
    const mErr = masteryError(mastery)
    if (mErr) {
      setError(mErr)
      setTab('maestria')
      return
    }
    try {
      const id = await save.mutateAsync({
        id: initial?.id,
        ...desc,
        category_id: categoryId === NO_FOLDER ? null : categoryId,
        ...mastery,
        targets: targets.filter((t) => t.name.trim()).map((t) => ({ id: t.id, name: t.name.trim() })),
      })
      setDirty(false)
      guard.allowLeave()
      toast.success(initial ? 'Modelo atualizado.' : 'Modelo criado na biblioteca.')
      navigate(initial ? '/biblioteca' : `/biblioteca/${id}`, { replace: !initial })
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function doArchive() {
    if (!initial) return
    try {
      await archive.mutateAsync(initial.id)
      guard.allowLeave()
      toast.success('Modelo arquivado.')
      navigate('/biblioteca')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link to="/biblioteca">
          <ArrowLeft aria-hidden /> Biblioteca
        </Link>
      </Button>
      <PageHeader
        title={initial ? 'Editar modelo' : 'Novo modelo'}
        description="Alterar um modelo não muda os programas que já foram atribuídos aos aprendizes."
        actions={
          initial && (
            <Button variant="outline" onClick={() => setConfirmArchive(true)}>
              <Archive aria-hidden /> Arquivar
            </Button>
          )
        }
      />

      <form onSubmit={(e) => void submit(e)} className="flex max-w-3xl flex-col gap-6" noValidate>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            <TabsList>
              <TabsTrigger value="descricao">Descrição</TabsTrigger>
              <TabsTrigger value="alvos">Alvos sugeridos ({targets.length})</TabsTrigger>
              <TabsTrigger value="maestria">Critério de maestria</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="descricao" className="mt-4">
            <Card>
              <CardContent>
                <DescriptionFields
                  value={desc}
                  onChange={touch(setDesc)}
                  nameError={nameError}
                  extra={
                    <FieldRow id="tf-category" label="Pasta">
                      <Select value={categoryId} onValueChange={touch(setCategoryId)}>
                        <SelectTrigger id="tf-category" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_FOLDER}>Sem pasta</SelectItem>
                          {(categories.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="alvos" className="mt-4">
            <Card>
              <CardContent className="flex flex-col gap-3">
                <p className="text-base text-muted-foreground">
                  Sugestões que já vêm preenchidas ao atribuir o programa a um aprendiz. Dá para tirar ou acrescentar alvos na hora.
                </p>
                <TargetListEditor value={targets} onChange={touch(setTargets)} emptyText="Nenhum alvo sugerido ainda." />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="maestria" className="mt-4">
            <Card>
              <CardContent>
                <MasteryFields value={mastery} onChange={touch(setMastery)} measure={desc.measure_type} goal={desc.goal} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <FormError message={error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" size="lg">
            <Link to="/biblioteca">Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar modelo'}
          </Button>
        </div>
      </form>

      {guard.dialog}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar este modelo?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Ele sai da biblioteca. Os aprendizes que já têm este programa continuam com a cópia deles, sem nenhuma mudança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doArchive()}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

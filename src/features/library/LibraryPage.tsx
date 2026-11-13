import { BookOpen, ChevronRight, Folder, FolderCog, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { GOAL_LABEL, MEASURE_SHORT, PROTOCOL_LABEL, protocolText, type MeasureType, type ProgramGoal, type Protocol } from '@/features/programs/constants'
import { cn } from '@/lib/utils'

import { useCategories, useTemplates } from './api'
import { CategoriesDialog } from './CategoriesDialog'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const ALL = 'todos'
const NO_FOLDER = 'sem-pasta'

export function LibraryPage() {
  const templates = useTemplates()
  const categories = useCategories()
  const [search, setSearch] = useState('')
  const [folder, setFolder] = useState<string>(ALL)
  const [measure, setMeasure] = useState<MeasureType | typeof ALL>(ALL)
  const [goal, setGoal] = useState<ProgramGoal | typeof ALL>(ALL)
  const [protocol, setProtocol] = useState<Protocol | typeof ALL>(ALL)
  const [foldersOpen, setFoldersOpen] = useState(false)

  const categoryIds = new Set((categories.data ?? []).map((c) => c.id))
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]))

  const list = useMemo(() => {
    const q = norm(search.trim())
    return (templates.data ?? []).filter((t) => {
      const inFolder = t.category_id && categoryIds.has(t.category_id) ? t.category_id : NO_FOLDER
      if (folder !== ALL && inFolder !== folder) return false
      if (measure !== ALL && t.measure_type !== measure) return false
      if (goal !== ALL && t.goal !== goal) return false
      if (protocol !== ALL && t.protocol !== protocol) return false
      return !q || norm(`${t.name} ${t.objective ?? ''}`).includes(q)
    })
  }, [templates.data, categories.data, search, folder, measure, goal, protocol])

  const countIn = (id: string) =>
    (templates.data ?? []).filter((t) => (id === NO_FOLDER ? !t.category_id || !categoryIds.has(t.category_id) : t.category_id === id)).length

  const folders = [
    { id: ALL, name: 'Todos os modelos', count: templates.data?.length ?? 0 },
    ...(categories.data ?? []).map((c) => ({ id: c.id, name: c.name, count: countIn(c.id) })),
    { id: NO_FOLDER, name: 'Sem pasta', count: countIn(NO_FOLDER) },
  ]

  return (
    <>
      <PageHeader
        title="Biblioteca de programas"
        description="Modelos da clínica. Ao atribuir a um aprendiz, o programa vira uma cópia própria dele."
        actions={
          <Button asChild size="lg">
            <Link to="/biblioteca/novo">
              <Plus aria-hidden /> Novo modelo
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Pastas */}
        <aside className="lg:w-60 lg:shrink-0">
          <div className="lg:hidden">
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger className="w-full" aria-label="Pasta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav aria-label="Pastas" className="hidden flex-col gap-1 lg:flex">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-base hover:bg-muted',
                  folder === f.id && 'bg-secondary font-medium text-secondary-foreground',
                )}
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-sm text-muted-foreground">{f.count}</span>
              </button>
            ))}
          </nav>
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={() => setFoldersOpen(true)}>
            <FolderCog aria-hidden /> Gerenciar pastas
          </Button>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou objetivo" className="pl-10" aria-label="Buscar modelo" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select value={measure} onValueChange={(v) => setMeasure(v as MeasureType)}>
                <SelectTrigger className="w-full" aria-label="Tipo de medida">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os tipos</SelectItem>
                  {(Object.keys(MEASURE_SHORT) as MeasureType[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEASURE_SHORT[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={goal} onValueChange={(v) => setGoal(v as ProgramGoal)}>
                <SelectTrigger className="w-full" aria-label="Objetivo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Aquisição e redução</SelectItem>
                  <SelectItem value="aquisicao">Aquisição</SelectItem>
                  <SelectItem value="reducao">Redução</SelectItem>
                </SelectContent>
              </Select>
              <Select value={protocol} onValueChange={(v) => setProtocol(v as Protocol)}>
                <SelectTrigger className="w-full" aria-label="Protocolo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os protocolos</SelectItem>
                  {(Object.keys(PROTOCOL_LABEL) as Protocol[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROTOCOL_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {templates.isPending ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : templates.isError ? (
            <Card>
              <CardContent className="text-base text-muted-foreground">Não foi possível carregar a biblioteca. Verifique sua conexão.</CardContent>
            </Card>
          ) : list.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <BookOpen className="size-10 text-muted-foreground" aria-hidden />
                <p className="text-base text-muted-foreground">
                  {(templates.data ?? []).length === 0 ? 'A biblioteca ainda está vazia. Crie o primeiro modelo.' : 'Nenhum modelo encontrado com esses filtros.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground">{list.length === 1 ? '1 modelo' : `${list.length} modelos`}</p>
              <ul className="flex flex-col gap-3">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link to={`/biblioteca/${t.id}`} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                      <Card className="transition-colors hover:bg-muted/40">
                        <CardContent className="flex items-center gap-3 py-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-medium">{t.name}</p>
                            {t.objective && <p className="line-clamp-2 text-sm text-muted-foreground">{t.objective}</p>}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge variant="secondary">{GOAL_LABEL[t.goal]}</Badge>
                              <Badge variant="outline">{MEASURE_SHORT[t.measure_type]}</Badge>
                              {t.protocol && <Badge variant="outline">{protocolText(t.protocol, t.protocol_other)}</Badge>}
                              {t.category_id && categoryName.get(t.category_id) && (
                                <Badge variant="outline">
                                  <Folder aria-hidden /> {categoryName.get(t.category_id)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="hidden text-sm whitespace-nowrap text-muted-foreground sm:block">
                            {t.targets_count === 1 ? '1 alvo sugerido' : `${t.targets_count} alvos sugeridos`}
                          </p>
                          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <CategoriesDialog open={foldersOpen} onOpenChange={setFoldersOpen} />
    </>
  )
}

import { ChevronRight, Plus, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useClinic } from '@/features/settings/useClinic'
import { ageLabel, formatDate, timeAgo } from '@/lib/dates'

import { learnerListName, useLearners, type LearnerListItem } from './api'

type StatusFilter = 'ativos' | 'inativos' | 'todos'
type SortKey = 'nome' | 'ultima' | 'cadastro'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function sortLearners(list: LearnerListItem[], key: SortKey) {
  const copy = [...list]
  if (key === 'nome') copy.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
  if (key === 'cadastro') copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (key === 'ultima')
    copy.sort((a, b) => (b.last_session_at ?? '').localeCompare(a.last_session_at ?? '') || a.full_name.localeCompare(b.full_name, 'pt-BR'))
  return copy
}

export function LearnersPage() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const learners = useLearners()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ativos')
  const [sort, setSort] = useState<SortKey>('nome')
  const initialsOnly = clinic.data?.show_initials_only ?? false
  const isCoord = profile?.role === 'coordenador'

  const list = useMemo(() => {
    const q = norm(search.trim())
    const filtered = (learners.data ?? []).filter((l) => {
      if (status === 'ativos' && !l.active) return false
      if (status === 'inativos' && l.active) return false
      return !q || norm(l.full_name).includes(q) || norm(l.initials).includes(q)
    })
    return sortLearners(filtered, sort)
  }, [learners.data, search, status, sort])

  return (
    <>
      <PageHeader
        title="Aprendizes"
        description={profile?.role === 'coordenador' ? 'Todos os aprendizes da clínica.' : 'Os aprendizes que você atende.'}
        actions={
          isCoord && (
            <Button asChild size="lg">
              <Link to="/aprendizes/novo">
                <Plus aria-hidden /> Cadastrar aprendiz
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou iniciais" className="pl-10" aria-label="Buscar aprendiz" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full md:w-40" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full md:w-48" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome (A–Z)</SelectItem>
              <SelectItem value="ultima">Última sessão</SelectItem>
              <SelectItem value="cadastro">Cadastro mais recente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {learners.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : learners.isError ? (
        <Card>
          <CardContent className="text-base text-muted-foreground">Não foi possível carregar os aprendizes. Verifique sua conexão.</CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-10 text-muted-foreground" aria-hidden />
            {(learners.data ?? []).length === 0 ? (
              <>
                <p className="text-lg font-medium">{isCoord ? 'Nenhum aprendiz cadastrado ainda' : 'Nenhum aprendiz vinculado a você'}</p>
                <p className="max-w-md text-base text-muted-foreground">
                  {isCoord ? 'Cadastre o primeiro aprendiz para começar.' : 'Quando a coordenação vincular você a um aprendiz, ele aparece aqui.'}
                </p>
              </>
            ) : (
              <p className="text-base text-muted-foreground">Nenhum aprendiz encontrado com esses filtros.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{list.length === 1 ? '1 aprendiz' : `${list.length} aprendizes`}</p>
          <ul className="flex flex-col gap-3">
            {list.map((l) => (
              <li key={l.id}>
                <Link to={`/aprendizes/${l.id}`} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex items-center gap-3 py-1">
                      <PersonAvatar
                        name={l.full_name}
                        initials={l.initials}
                        photoPath={l.photo_path}
                        hidePhoto={initialsOnly}
                        bucket="learner-photos"
                        className="size-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-base font-medium">
                          <span className="truncate">{learnerListName(l, initialsOnly)}</span>
                          {!l.active && <Badge variant="outline">Inativo</Badge>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {l.last_session_at ? `Última sessão ${timeAgo(l.last_session_at)}` : 'Nenhuma sessão ainda'}
                          {!initialsOnly && l.birth_date && <span className="hidden sm:inline"> · {ageLabel(l.birth_date)}</span>}
                        </p>
                        <p className="text-sm text-muted-foreground md:hidden">Cadastro em {formatDate(l.created_at)}</p>
                      </div>
                      <p className="hidden text-sm text-muted-foreground md:block">Cadastro em {formatDate(l.created_at)}</p>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

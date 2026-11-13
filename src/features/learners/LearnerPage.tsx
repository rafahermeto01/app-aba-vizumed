import { ArrowLeft, Construction, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE_LABEL, useAuth } from '@/features/auth/AuthProvider'
import { ProgramsTab } from '@/features/programs/ProgramsTab'
import { useTeam } from '@/features/team/api'
import { maskCpf } from '@/lib/cpf'
import { ageLabel, formatDate, formatDateOnly, formatDateTime } from '@/lib/dates'

import { useLearner, type LearnerDetail } from './api'

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  )
}

function Soon({ phase, text }: { phase: number; text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Construction className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-lg font-medium">Chega na fase {phase}</p>
        <p className="max-w-md text-base text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}

function RegistrationTab({ learner }: { learner: LearnerDetail }) {
  const team = useTeam()
  const registeredBy = learner.consent ? (team.data ?? []).find((m) => m.id === learner.consent!.registered_by)?.full_name : undefined

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info label="Nome completo">{learner.full_name}</Info>
            <Info label="Iniciais">{learner.initials || '—'}</Info>
            <Info label="Data de nascimento">
              {learner.birth_date ? `${formatDateOnly(learner.birth_date)} (${ageLabel(learner.birth_date)})` : '—'}
            </Info>
            <Info label="CPF">{learner.cpf ? maskCpf(learner.cpf) : '—'}</Info>
            <Info label="Cadastrado em">{formatDate(learner.created_at)}</Info>
            <Info label="Situação">{learner.active ? 'Ativo' : 'Inativo'}</Info>
          </dl>
          {learner.notes && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="text-base whitespace-pre-line">{learner.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Responsáveis</CardTitle>
        </CardHeader>
        <CardContent>
          {learner.guardians.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhum responsável cadastrado.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {learner.guardians.map((g) => (
                <li key={g.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-base font-medium">
                    {g.name} {g.relationship && <span className="font-normal text-muted-foreground">· {g.relationship}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {g.phone && (
                      <a href={`tel:${g.phone.replace(/\D/g, '')}`} className="inline-flex min-h-11 items-center gap-1.5 text-base text-primary">
                        <Phone className="size-4" aria-hidden /> {g.phone}
                      </a>
                    )}
                    {g.email && (
                      <a href={`mailto:${g.email}`} className="inline-flex min-h-11 items-center gap-1.5 text-base break-all text-primary">
                        <Mail className="size-4" aria-hidden /> {g.email}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {learner.team.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhum profissional vinculado.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {learner.team.map((t) => (
                <li key={t.profile_id} className="flex items-center gap-3">
                  <PersonAvatar name={t.full_name} photoPath={t.photo_path} bucket="profile-photos" className="size-10" />
                  <div>
                    <p className="text-base">{t.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_LABEL[t.role]}
                      {!t.active && ' · desativado'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consentimento LGPD</CardTitle>
        </CardHeader>
        <CardContent>
          {learner.consent ? (
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-base">
                  Registrado em {formatDateTime(learner.consent.accepted_at)}
                  {registeredBy ? ` por ${registeredBy}` : ''}.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">“{learner.consent.consent_text}”</p>
              </div>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">Sem consentimento registrado. A coordenação precisa registrar na edição do cadastro.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function LearnerPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const learner = useLearner(id)
  const data = learner.data
  const [params, setParams] = useSearchParams()
  const tabs = ['programas', 'sessoes', 'desempenho', 'cadastro']
  const tab = tabs.includes(params.get('aba') ?? '') ? params.get('aba')! : 'programas'

  useEffect(() => {
    if (data) document.title = `${data.initials || 'Aprendiz'} · LovABA`
  }, [data])

  const back = (
    <Button asChild variant="ghost" className="mb-2 -ml-3">
      <Link to="/aprendizes">
        <ArrowLeft aria-hidden /> Aprendizes
      </Link>
    </Button>
  )

  if (learner.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-28 w-full rounded-xl" />
      </>
    )
  }
  if (!data) {
    return (
      <>
        {back}
        <Card>
          <CardContent className="py-10 text-center text-base text-muted-foreground">
            {learner.isError ? 'Não foi possível carregar agora. Verifique sua conexão.' : 'Aprendiz não encontrado, ou você não tem acesso a ele.'}
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {back}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <PersonAvatar name={data.full_name} initials={data.initials} photoPath={data.photo_path} bucket="learner-photos" className="size-20 text-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{data.full_name}</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {data.initials}
            {data.birth_date && ` · ${ageLabel(data.birth_date)}`}
            {!data.active && ' · Inativo'}
          </p>
          {data.cids.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.cids.map((c) => (
                <Badge key={c.id} variant="secondary" title={c.description}>
                  {c.code}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {profile?.role === 'coordenador' && (
          <Button asChild variant="outline" className="self-start sm:self-center">
            <Link to={`/aprendizes/${data.id}/editar`}>
              <Pencil aria-hidden /> Editar cadastro
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <TabsList>
            <TabsTrigger value="programas">Programas</TabsTrigger>
            <TabsTrigger value="sessoes">Sessões</TabsTrigger>
            <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="cadastro" className="mt-4">
          <RegistrationTab learner={data} />
        </TabsContent>
        <TabsContent value="programas" className="mt-4">
          <ProgramsTab learner={data} />
        </TabsContent>
        <TabsContent value="sessoes" className="mt-4">
          <Soon phase={5} text="Lista de sessões por semana e mês, com detalhes de cada atendimento." />
        </TabsContent>
        <TabsContent value="desempenho" className="mt-4">
          <Soon phase={5} text="Gráficos de evolução, programas concluídos e alvos masterizados." />
        </TabsContent>
      </Tabs>
    </>
  )
}

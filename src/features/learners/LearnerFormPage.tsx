import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { PhotoPicker, type PhotoChoice } from '@/components/PhotoPicker'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FullScreenLoader } from '@/features/auth/RequireAuth'
import { FormError } from '@/features/auth/AuthCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTeam } from '@/features/team/api'
import { cpfDigits, isValidCpf, maskCpf } from '@/lib/cpf'
import { formatDateTime, todayIso } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { makeInitials } from '@/lib/initials'
import { removeFile, uploadPhoto } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

import { LGPD_CONSENT_TEXT, useLearner, useSaveLearner, type LearnerDetail } from './api'
import { CidPicker } from './CidPicker'
import { emptyGuardian, GuardiansField, type GuardianDraft } from './GuardiansField'
import { TeamPicker } from './TeamPicker'

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

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Página: carrega o aprendiz (na edição) e mostra o formulário. */
export function LearnerFormPage() {
  const { id } = useParams()
  const learner = useLearner(id)
  if (id && learner.isPending) return <FullScreenLoader />
  if (id && !learner.data) {
    return (
      <>
        <PageHeader title="Aprendiz não encontrado" />
        <Button asChild variant="outline">
          <Link to="/aprendizes">Voltar para a lista</Link>
        </Button>
      </>
    )
  }
  return <LearnerForm key={id ?? 'novo'} initial={learner.data ?? null} />
}

type Errors = Partial<Record<'full_name' | 'initials' | 'cpf' | 'birth_date' | 'consent', string>> & { guardians?: Record<string, string> }

function LearnerForm({ initial }: { initial: LearnerDetail | null }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const team = useTeam()
  const save = useSaveLearner()
  const editing = Boolean(initial)

  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [initials, setInitials] = useState(initial?.initials ?? '')
  const [initialsTouched, setInitialsTouched] = useState(editing)
  const [cpf, setCpf] = useState(initial?.cpf ? maskCpf(initial.cpf) : '')
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [photo, setPhoto] = useState<PhotoChoice>({ kind: 'keep' })
  const [cidIds, setCidIds] = useState<string[]>(initial?.cids.map((c) => c.id) ?? [])
  const [teamIds, setTeamIds] = useState<string[]>(initial?.team.map((t) => t.profile_id) ?? [])
  const [guardians, setGuardians] = useState<GuardianDraft[]>(
    initial?.guardians.map((g) => ({
      key: g.id,
      id: g.id,
      name: g.name,
      relationship: g.relationship ?? '',
      phone: g.phone ?? '',
      email: g.email ?? '',
    })) ?? [emptyGuardian()],
  )
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const allowLeave = useRef(false)

  // Avisa antes de sair da página com alterações não salvas
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname,
  )

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }

  function onNameChange(v: string) {
    setFullName(v)
    if (!initialsTouched) setInitials(makeInitials(v).slice(0, 6))
    setDirty(true)
  }

  const registeredBy = initial?.consent ? (team.data ?? []).find((m) => m.id === initial.consent!.registered_by)?.full_name : undefined

  function validate(): Errors {
    const e: Errors = {}
    if (!fullName.trim()) e.full_name = 'Informe o nome completo.'
    if (initials.trim().length > 6) e.initials = 'No máximo 6 letras.'
    if (cpfDigits(cpf).length > 0 && !isValidCpf(cpf)) e.cpf = 'CPF inválido. Confira os números.'
    if (birthDate) {
      if (birthDate > todayIso()) e.birth_date = 'A data de nascimento não pode ser no futuro.'
      else if (birthDate < '1900-01-01') e.birth_date = 'Data de nascimento inválida.'
    }
    const gErrors: Record<string, string> = {}
    for (const g of guardians) {
      const filled = g.name.trim() || g.relationship.trim() || g.phone.trim() || g.email.trim()
      if (filled && !g.name.trim()) gErrors[g.key] = 'Informe o nome do responsável.'
      if (g.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email.trim())) gErrors[g.key] = 'E-mail do responsável inválido.'
    }
    if (Object.keys(gErrors).length) e.guardians = gErrors
    if (!initial?.consent && !consent) e.consent = 'É obrigatório confirmar o consentimento LGPD.'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!profile) return
    const e = validate()
    setErrors(e)
    setFormError(null)
    if (Object.keys(e).length) {
      setFormError('Confira os campos destacados.')
      return
    }
    setSaving(true)
    try {
      const id = await save.mutateAsync({
        id: initial?.id,
        full_name: fullName.trim(),
        initials: initials.trim().toUpperCase(),
        cpf: cpfDigits(cpf) || null,
        birth_date: birthDate || null,
        notes: notes.trim() || null,
        active,
        cid_ids: cidIds,
        team_ids: teamIds,
        guardians: guardians
          .filter((g) => g.name.trim())
          .map((g) => ({ id: g.id, name: g.name.trim(), relationship: g.relationship.trim(), phone: g.phone.trim(), email: g.email.trim() })),
        consent_accepted: consent,
      })

      // Foto: enviada depois que o aprendiz existe (a pasta é por aprendiz)
      if (photo.kind !== 'keep') {
        try {
          const newPath = photo.kind === 'new' ? await uploadPhoto('learner-photos', profile.clinic_id, id, photo.file) : null
          const { error } = await supabase.from('learners').update({ photo_path: newPath }).eq('id', id)
          if (error) throw error
          await removeFile('learner-photos', initial?.photo_path)
        } catch {
          toast.warning('Os dados foram salvos, mas a foto não foi enviada. Tente de novo pela edição.')
        }
      }

      setDirty(false)
      allowLeave.current = true
      toast.success(editing ? 'Aprendiz atualizado.' : 'Aprendiz cadastrado.')
      navigate(`/aprendizes/${id}`, { replace: !editing })
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 self-start">
        <Link to={initial ? `/aprendizes/${initial.id}` : '/aprendizes'}>
          <ArrowLeft aria-hidden /> Voltar
        </Link>
      </Button>
      <PageHeader title={editing ? 'Editar aprendiz' : 'Cadastrar aprendiz'} />

      <form onSubmit={(e) => void submit(e)} className="flex max-w-3xl flex-col gap-6" noValidate>
        <Section title="Dados pessoais">
          <PhotoPicker name={fullName} currentPath={initial?.photo_path} bucket="learner-photos" value={photo} onChange={touch(setPhoto)} disabled={saving} />
          <Field id="l-name" label="Nome completo" error={errors.full_name}>
            <Input id="l-name" value={fullName} onChange={(e) => onNameChange(e.target.value)} aria-invalid={Boolean(errors.full_name) || undefined} autoComplete="off" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="l-initials" label="Iniciais" hint="Geradas pelo nome. Pode editar." error={errors.initials}>
              <Input
                id="l-initials"
                value={initials}
                maxLength={6}
                onChange={(e) => {
                  setInitials(e.target.value.toUpperCase().replace(/[^A-ZÀ-Ý]/g, ''))
                  setInitialsTouched(true)
                  setDirty(true)
                }}
                aria-invalid={Boolean(errors.initials) || undefined}
                autoComplete="off"
              />
            </Field>
            <Field id="l-birth" label="Data de nascimento" error={errors.birth_date}>
              <Input
                id="l-birth"
                type="date"
                value={birthDate}
                max={todayIso()}
                onChange={(e) => touch(setBirthDate)(e.target.value)}
                aria-invalid={Boolean(errors.birth_date) || undefined}
              />
            </Field>
            <Field id="l-cpf" label="CPF (opcional)" error={errors.cpf}>
              <Input
                id="l-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => touch(setCpf)(maskCpf(e.target.value))}
                aria-invalid={Boolean(errors.cpf) || undefined}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field id="l-notes" label="Observações (opcional)">
            <Textarea id="l-notes" value={notes} onChange={(e) => touch(setNotes)(e.target.value)} maxLength={2000} />
          </Field>
          {editing && (
            <label htmlFor="l-active" className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4">
              <span>
                <span className="block text-base font-medium">Aprendiz ativo</span>
                <span className="block text-sm text-muted-foreground">Inativos saem da lista principal, mas todo o histórico continua guardado.</span>
              </span>
              <Switch id="l-active" checked={active} onCheckedChange={touch(setActive)} />
            </label>
          )}
        </Section>

        <Section title="Diagnóstico (CID)" description="Um aprendiz pode ter mais de um CID.">
          <CidPicker id="l-cid" value={cidIds} onChange={touch(setCidIds)} />
        </Section>

        <Section title="Responsáveis">
          <GuardiansField value={guardians} onChange={touch(setGuardians)} errors={errors.guardians} />
        </Section>

        <Section title="Equipe" description="Quem atende este aprendiz. Só quem estiver marcado vê o aprendiz e registra sessões.">
          <TeamPicker value={teamIds} onChange={touch(setTeamIds)} />
        </Section>

        <Section title="Consentimento LGPD">
          {initial?.consent ? (
            <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-base">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <p>
                Consentimento registrado em {formatDateTime(initial.consent.accepted_at)}
                {registeredBy ? ` por ${registeredBy}` : ''}.
              </p>
            </div>
          ) : (
            <label htmlFor="l-consent" className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
              <Checkbox
                id="l-consent"
                checked={consent}
                onCheckedChange={(c) => touch(setConsent)(c === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.consent) || undefined}
              />
              <span className="text-base">{LGPD_CONSENT_TEXT}</span>
            </label>
          )}
          {errors.consent && <p className="text-sm text-destructive">{errors.consent}</p>}
        </Section>

        <FormError message={formError} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" size="lg">
            <Link to={initial ? `/aprendizes/${initial.id}` : '/aprendizes'}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar aprendiz'}
          </Button>
        </div>
      </form>

      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">As alterações feitas neste formulário serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.state === 'blocked' && blocker.reset()}>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.state === 'blocked' && blocker.proceed()}>Sair sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

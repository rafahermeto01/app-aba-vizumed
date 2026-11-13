import { Angry, ArrowLeft, Check, CircleAlert, Eraser, Frown, Laugh, Meh, Smile } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import SignatureCanvas from 'react-signature-canvas'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/features/auth/AuthCard'
import { FullScreenLoader } from '@/features/auth/RequireAuth'
import { formatTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ops } from '@/offline'
import type { LocalSession } from '@/offline/db'
import { useLocalSession, useSessionTrials } from '@/offline/hooks'

import { Shell } from './Shell'
import { formatDuration } from './stats'
import { useBeforeUnload, useNow, useWakeLock } from './useDevice'

export const RATINGS = [
  { value: 1, label: 'Muito ruim', Icon: Angry },
  { value: 2, label: 'Ruim', Icon: Frown },
  { value: 3, label: 'Regular', Icon: Meh },
  { value: 4, label: 'Bom', Icon: Smile },
  { value: 5, label: 'Ótimo', Icon: Laugh },
] as const

export const SIGNATURE_STATEMENT = 'Ao prosseguir, declaro que sou responsável pelo lançamento dos dados e que assinei este registro de forma legítima.'

export function FinalizePage() {
  const { sessionId } = useParams()
  const session = useLocalSession(sessionId)
  if (session === undefined) return <FullScreenLoader />
  if (!session) return <Navigate to="/" replace />
  if (session.status === 'finalizada') return <Navigate to={`/sessao/${session.id}/resumo`} replace />
  return <Finalize session={session} />
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-base">
      {ok ? <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-label="ok" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="pendente" />}
      <span className={ok ? '' : 'text-muted-foreground'}>{children}</span>
    </li>
  )
}

function Finalize({ session }: { session: LocalSession }) {
  const navigate = useNavigate()
  const trials = useSessionTrials(session.id)
  const now = useNow(1000)
  const sigRef = useRef<SignatureCanvas>(null)
  const [rating, setRating] = useState<number | null>(session.rating)
  const [notes, setNotes] = useState(session.notes)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useWakeLock(true)
  useBeforeUnload(true)

  const active = trials.filter((t) => !t.deleted_at)
  const programsWithData = session.programs.filter((p) => active.some((t) => t.program_id === p.id)).length
  const elapsed = (now - new Date(session.started_at).getTime()) / 1000

  function changeNotes(v: string) {
    setNotes(v)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => void ops.updateSession(session.id, { notes: v }).catch(() => undefined), 600)
  }

  function chooseRating(v: number) {
    setRating(v)
    void ops.updateSession(session.id, { rating: v }).catch(() => undefined)
  }

  async function finish() {
    setError(null)
    const pad = sigRef.current
    if (!pad || pad.isEmpty()) return setError('Assine no quadro para finalizar.')
    setSaving(true)
    try {
      if (notesTimer.current) clearTimeout(notesTimer.current)
      await ops.finalizeSession(session.id, { rating, notes: notes.trim(), signature_data_url: pad.toDataURL('image/png') })
      navigate(`/sessao/${session.id}/resumo`, { replace: true })
    } catch {
      setError('Não foi possível finalizar no aparelho. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Shell
      back={
        <Button asChild variant="ghost" className="-ml-3">
          <Link to={`/sessao/${session.id}`}>
            <ArrowLeft aria-hidden /> Voltar para a coleta
          </Link>
        </Button>
      }
      title="Finalizar sessão"
      subtitle={session.learner_name}
    >
      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-base">
            <div>
              <dt className="text-sm text-muted-foreground">Aplicador(a)</dt>
              <dd>{session.applicator_name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Duração</dt>
              <dd>{formatDuration(elapsed)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Início</dt>
              <dd>{formatTime(session.started_at)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fim</dt>
              <dd>{formatTime(now)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            <CheckItem ok={session.programs.length === 0 || programsWithData === session.programs.length}>
              Execução: {session.programs.length === 0 ? 'sessão só com notas' : `${programsWithData} de ${session.programs.length} programas com registros`}
            </CheckItem>
            <CheckItem ok={rating !== null}>Avaliação da sessão</CheckItem>
            <CheckItem ok={notes.trim().length > 0}>Notas preenchidas</CheckItem>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como foi a sessão?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Avaliação da sessão">
            {RATINGS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                onClick={() => chooseRating(value)}
                className={cn(
                  'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border bg-card px-1 text-center active:scale-95',
                  rating === value && 'border-2 border-primary bg-primary/10',
                )}
              >
                <Icon className={cn('size-8', rating === value ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                <span className="text-xs leading-tight sm:text-sm">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notas da sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={(e) => changeNotes(e.target.value)} className="min-h-32" placeholder="Registro de evolução diária" aria-label="Notas da sessão" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed bg-white">
            {!signed && <span className="pointer-events-none absolute inset-0 grid place-items-center text-lg text-muted-foreground">Desenhe aqui</span>}
            <SignatureCanvas
              ref={sigRef}
              penColor="#0f172a"
              minWidth={1.2}
              maxWidth={2.8}
              onBegin={() => setSigned(true)}
              canvasProps={{ className: 'block h-52 w-full touch-none', 'aria-label': 'Quadro para assinatura' }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{SIGNATURE_STATEMENT}</p>
          <FormError message={error} />
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-14"
              onClick={() => {
                sigRef.current?.clear()
                setSigned(false)
              }}
            >
              <Eraser aria-hidden /> Limpar
            </Button>
            <Button type="button" size="lg" className="h-14 text-lg" onClick={() => void finish()} disabled={saving}>
              <Check aria-hidden /> {saving ? 'Finalizando…' : 'Finalizar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Shell>
  )
}

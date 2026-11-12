import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABEL, type UserRole } from '@/features/auth/AuthProvider'
import { FormError } from '@/features/auth/AuthCard'
import { MIN_PASSWORD } from '@/features/auth/messages'

import { suggestPassword, useAdminAction, type TeamMember } from './api'

const ROLE_HELP: Record<UserRole, string> = {
  coordenador: 'Acesso total: equipe, aprendizes, programas e configurações.',
  supervisor: 'Cria e ajusta programas dos aprendizes vinculados.',
  aplicador: 'Aplica as sessões e registra os dados dos aprendizes vinculados.',
}

/** Mostra o e-mail e a senha provisória para a coordenação repassar à pessoa. */
function CredentialsNotice({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = `Acesso ao LovABA\nE-mail: ${email}\nSenha provisória: ${password}\nNo primeiro acesso, o sistema vai pedir para criar uma senha nova.`
  return (
    <>
      <div className="rounded-xl border bg-muted/40 p-4 text-base">
        <p>
          <span className="text-muted-foreground">E-mail:</span> <strong className="break-all">{email}</strong>
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Senha provisória:</span> <strong className="font-mono">{password}</strong>
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Repasse estes dados para a pessoa. No primeiro acesso, o LovABA vai pedir que ela crie uma senha nova. Esta senha não
        aparece de novo depois que você fechar esta janela.
      </p>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true))
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Copiado' : 'Copiar dados'}
        </Button>
        <Button type="button" onClick={onClose}>
          Pronto
        </Button>
      </DialogFooter>
    </>
  )
}

function PasswordField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="flex gap-2">
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" className="font-mono" required minLength={MIN_PASSWORD} />
      <Button type="button" variant="outline" size="icon" aria-label="Gerar outra senha" title="Gerar outra senha" onClick={() => onChange(suggestPassword())}>
        <RefreshCw aria-hidden />
      </Button>
    </div>
  )
}

/** Adicionar membro (com senha provisória) ou editar nome / perfil de acesso. */
export function MemberDialog({
  open,
  onOpenChange,
  member,
  isSelf = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: TeamMember | null
  isSelf?: boolean
}) {
  const editing = Boolean(member)
  const action = useAdminAction()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('aplicador')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setFullName(member?.full_name ?? '')
    setEmail(member?.email ?? '')
    setRole(member?.role ?? 'aplicador')
    setPassword(suggestPassword())
    setError(null)
    setDone(null)
  }, [open, member])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!editing && password.length < MIN_PASSWORD) {
      setError(`A senha provisória precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    try {
      if (editing && member) {
        await action.mutateAsync({ action: 'update', user_id: member.id, full_name: fullName, ...(isSelf ? {} : { role }) })
        toast.success('Dados atualizados.')
        onOpenChange(false)
      } else {
        await action.mutateAsync({ action: 'create', full_name: fullName, email, role, password })
        setDone({ email: email.trim().toLowerCase(), password })
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{done ? 'Membro cadastrado' : editing ? 'Editar membro' : 'Adicionar membro'}</DialogTitle>
          {!done && !editing && (
            <DialogDescription>A pessoa entra com a senha provisória e cria a própria senha no primeiro acesso.</DialogDescription>
          )}
        </DialogHeader>

        {done ? (
          <CredentialsNotice email={done.email} password={done.password} onClose={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-name">Nome completo</Label>
              <Input id="m-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="off" />
            </div>
            {!editing && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-email">E-mail</Label>
                <Input id="m-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-role">Perfil de acesso</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={isSelf}>
                <SelectTrigger id="m-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{isSelf ? 'Você não pode mudar o seu próprio perfil de acesso.' : ROLE_HELP[role]}</p>
            </div>
            {!editing && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-pass">Senha provisória</Label>
                <PasswordField id="m-pass" value={password} onChange={setPassword} />
                <p className="text-sm text-muted-foreground">Sugerimos uma senha; você pode trocar. Mínimo de {MIN_PASSWORD} caracteres.</p>
              </div>
            )}
            <FormError message={error} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={action.isPending}>
                {action.isPending ? 'Salvando…' : editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Define uma nova senha provisória para alguém que esqueceu a senha. */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: TeamMember | null
}) {
  const action = useAdminAction()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setPassword(suggestPassword())
    setError(null)
    setDone(false)
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!member) return
    setError(null)
    if (password.length < MIN_PASSWORD) {
      setError(`A senha provisória precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    try {
      await action.mutateAsync({ action: 'reset_password', user_id: member.id, password })
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden /> {done ? 'Senha redefinida' : 'Redefinir senha'}
          </DialogTitle>
          {!done && member && (
            <DialogDescription>
              {member.full_name} vai entrar com esta senha provisória e criar uma nova no próximo acesso.
            </DialogDescription>
          )}
        </DialogHeader>
        {done && member ? (
          <CredentialsNotice email={member.email} password={password} onClose={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-pass">Nova senha provisória</Label>
              <PasswordField id="r-pass" value={password} onChange={setPassword} />
            </div>
            <FormError message={error} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={action.isPending}>
                {action.isPending ? 'Salvando…' : 'Redefinir senha'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

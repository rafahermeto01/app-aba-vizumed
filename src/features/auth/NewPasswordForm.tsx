import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

import { FormError } from './AuthCard'
import { MIN_PASSWORD, authErrorMessage } from './messages'

/** Formulário "nova senha + confirmar". Usado na troca obrigatória e na redefinição. */
export function NewPasswordForm({ onDone, submitLabel = 'Salvar nova senha' }: { onDone: () => Promise<void> | void; submitLabel?: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && confirm !== password

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
    if (password !== confirm) return setError('As duas senhas não são iguais.')
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setSubmitting(false)
      return setError(authErrorMessage(error))
    }
    try {
      await onDone()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={tooShort || undefined}
          aria-describedby="new-password-hint"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p id="new-password-hint" className="text-sm text-muted-foreground">
          Mínimo de {MIN_PASSWORD} caracteres.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirme a nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={mismatch || undefined}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && <p className="text-sm text-destructive">As senhas não são iguais.</p>}
      </div>
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={submitting || !password || !confirm}>
        {submitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

import { AuthCard, FormError } from './AuthCard'
import { authErrorMessage } from './messages'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setSubmitting(false)
    // Por segurança, a mensagem é a mesma exista ou não o e-mail.
    if (error && !error.message.toLowerCase().includes('not found')) setError(authErrorMessage(error))
    else setSent(true)
  }

  if (sent) {
    return (
      <AuthCard title="Verifique seu e-mail" description="Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.">
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Esqueci minha senha" description="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={submitting || !email.includes('@')}>
          {submitting ? 'Enviando…' : 'Enviar link'}
        </Button>
        <Link to="/login" className="text-center text-base text-primary underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      </form>
    </AuthCard>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

import { AuthCard, FormError } from './AuthCard'
import { useAuth } from './AuthProvider'
import { authErrorMessage } from './messages'

export function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSubmitting(false)
    if (error) setError(authErrorMessage(error))
  }

  return (
    <AuthCard title="Entrar" description="Use o e-mail e a senha cadastrados pela coordenação.">
      {/* Não existe cadastro público: contas são criadas pela coordenação. */}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={submitting || !email || !password}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <Link to="/esqueci-senha" className="text-center text-base text-primary underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </form>
    </AuthCard>
  )
}

import { useNavigate } from 'react-router'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

import { AuthCard } from './AuthCard'
import { useAuth } from './AuthProvider'
import { NewPasswordForm } from './NewPasswordForm'

/** Aberta pelo link "redefinir senha" enviado por e-mail. */
export function ResetPasswordPage() {
  const { session, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  if (loading) return null

  if (!session) {
    return (
      <AuthCard title="Link expirado" description="Este link de redefinição não é mais válido. Peça um novo.">
        <Button asChild size="lg" className="w-full">
          <Link to="/esqueci-senha">Pedir novo link</Link>
        </Button>
      </AuthCard>
    )
  }

  async function onDone() {
    // Se havia uma senha provisória pendente, a troca também a resolve.
    await supabase.rpc('complete_password_change')
    await refreshProfile()
    navigate('/', { replace: true })
  }

  return (
    <AuthCard title="Nova senha" description="Escolha uma nova senha para entrar no LovABA.">
      <NewPasswordForm onDone={onDone} />
    </AuthCard>
  )
}

import { Navigate, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

import { AuthCard } from './AuthCard'
import { useAuth } from './AuthProvider'
import { NewPasswordForm } from './NewPasswordForm'

/** Troca obrigatória da senha provisória no primeiro acesso. */
export function ChangePasswordPage() {
  const { session, profile, loading, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile && !profile.must_change_password) return <Navigate to="/" replace />

  async function onDone() {
    // O banco confere se a senha realmente mudou antes de liberar o acesso.
    const { data, error } = await supabase.rpc('complete_password_change')
    if (error) throw error
    if (data !== true) throw new Error('A nova senha precisa ser diferente da senha provisória.')
    await refreshProfile()
    navigate('/', { replace: true })
  }

  return (
    <AuthCard
      title="Crie sua senha"
      description={
        <>
          Olá{profile ? `, ${profile.full_name.split(' ')[0]}` : ''}! Este é seu primeiro acesso. Para sua segurança, troque a senha
          provisória por uma senha só sua.
        </>
      }
    >
      <NewPasswordForm onDone={onDone} submitLabel="Salvar e entrar" />
      <Button variant="ghost" className="mt-3 w-full" onClick={() => void signOut()}>
        Sair
      </Button>
    </AuthCard>
  )
}

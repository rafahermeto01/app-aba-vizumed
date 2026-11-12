import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'

import { AuthCard } from './AuthCard'
import { useAuth, type UserRole } from './AuthProvider'

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Carregando">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
    </div>
  )
}

/**
 * Porteiro das telas internas:
 *  - sem login → tela de login
 *  - acesso desativado → aviso
 *  - senha provisória → troca obrigatória antes de qualquer tela
 *  - papel sem permissão → volta ao início
 */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { session, profile, loading, recovering, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (recovering) return <Navigate to="/redefinir-senha" replace />

  if (!profile || !profile.active) {
    return (
      <AuthCard title="Acesso desativado" description="Seu acesso ao LovABA não está ativo. Fale com a coordenação da clínica.">
        <Button size="lg" variant="outline" className="w-full" onClick={() => void signOut()}>
          Sair
        </Button>
      </AuthCard>
    )
  }

  if (profile.must_change_password) return <Navigate to="/trocar-senha" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return <>{children}</>
}

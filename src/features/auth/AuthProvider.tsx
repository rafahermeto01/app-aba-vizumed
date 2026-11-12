import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'

export type UserRole = 'coordenador' | 'supervisor' | 'aplicador'

export type Profile = {
  id: string
  clinic_id: string
  full_name: string
  email: string
  photo_path: string | null
  role: UserRole
  active: boolean
  must_change_password: boolean
}

export const ROLE_LABEL: Record<UserRole, string> = {
  coordenador: 'Coordenador(a)',
  supervisor: 'Supervisor(a)',
  aplicador: 'Terapeuta / AT',
}

type AuthState = {
  /** true enquanto ainda estamos descobrindo se há alguém logado */
  loading: boolean
  session: Session | null
  profile: Profile | null
  /** veio de um link de "redefinir senha" */
  recovering: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
      setSessionLoaded(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, clinic_id, full_name, email, photo_path, role, active, must_change_password')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data as Profile | null) ?? null
    },
  })

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] })
  }, [queryClient])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setRecovering(false)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      loading: !sessionLoaded || (Boolean(userId) && profileQuery.isPending),
      session,
      profile: profileQuery.data ?? null,
      recovering,
      refreshProfile,
      signOut,
    }),
    [sessionLoaded, userId, profileQuery.isPending, profileQuery.data, session, recovering, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

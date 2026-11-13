import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'
import { setSyncUser } from '@/offline'
import { clearPersistedQueries } from '@/offline/queryPersist'

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
  /** não foi possível carregar o perfil (sem internet e sem cópia no aparelho) */
  profileError: boolean
  retryProfile: () => void
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
    supabase.auth
      .getSession()
      .then(({ data }) => {
        // Sem internet e com o acesso vencido, o Supabase não consegue renovar:
        // continuamos com o login guardado no aparelho para a coleta não parar.
        setSession(data.session ?? (navigator.onLine ? null : readStoredSession()))
        setSessionLoaded(true)
      })
      .catch(() => {
        setSession(readStoredSession())
        setSessionLoaded(true)
      })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (!next && event !== 'SIGNED_OUT' && !navigator.onLine) return // sem internet: mantém o login do aparelho
      setSession(next)
      setSessionLoaded(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  useEffect(() => {
    setSyncUser(userId ?? null)
  }, [userId])
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
    // Os registros da coleta NÃO são apagados do aparelho: só a cópia das telas.
    await supabase.auth.signOut().catch(() => undefined)
    setSession(null)
    setRecovering(false)
    queryClient.clear()
    await clearPersistedQueries()
  }, [queryClient])

  const retryProfile = useCallback(() => {
    void profileQuery.refetch()
  }, [profileQuery])

  const value = useMemo<AuthState>(
    () => ({
      loading: !sessionLoaded || (Boolean(userId) && profileQuery.isPending),
      session,
      profile: profileQuery.data ?? null,
      recovering,
      profileError: profileQuery.isError && !profileQuery.data,
      retryProfile,
      refreshProfile,
      signOut,
    }),
    [sessionLoaded, userId, profileQuery.isPending, profileQuery.isError, profileQuery.data, session, recovering, retryProfile, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Login guardado no aparelho pelo Supabase (usado só quando estamos sem internet). */
function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem('lovaba-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session | { currentSession?: Session }
    const s = 'user' in parsed ? parsed : parsed.currentSession
    return s?.user?.id ? (s as Session) : null
  } catch {
    return null
  }
}

// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

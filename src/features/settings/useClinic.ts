import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

export type Clinic = {
  id: string
  name: string
  logo_path: string | null
  show_initials_only: boolean
}

/** Dados da clínica de quem está logado (nome, logo, preferência de privacidade). */
export function useClinic() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['clinic', profile?.clinic_id],
    enabled: Boolean(profile?.clinic_id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Clinic> => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, logo_path, show_initials_only')
        .eq('id', profile!.clinic_id)
        .single()
      if (error) throw error
      return data
    },
  })
}

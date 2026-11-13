import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

export type PromptLevel = {
  id: string
  name: string
  abbreviation: string
  color: string
  sort_order: number
  is_independent: boolean
  deleted_at: string | null
}

/**
 * Níveis de ajuda da clínica (inclui os removidos, para continuar mostrando
 * a sigla certa no histórico). Use `active` para as listas de escolha.
 */
export function usePromptLevels() {
  const { profile } = useAuth()
  const query = useQuery({
    queryKey: ['prompt-levels', profile?.clinic_id],
    enabled: Boolean(profile?.clinic_id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PromptLevel[]> => {
      const { data, error } = await supabase
        .from('prompt_levels')
        .select('id, name, abbreviation, color, sort_order, is_independent, deleted_at')
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
  const all = query.data ?? []
  return {
    ...query,
    all,
    active: all.filter((l) => !l.deleted_at),
    byId: new Map(all.map((l) => [l.id, l])),
  }
}

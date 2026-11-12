import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth, type UserRole } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

export type TeamMember = {
  id: string
  full_name: string
  email: string
  role: UserRole
  active: boolean
  must_change_password: boolean
  photo_path: string | null
  created_at: string
}

/** Todos os membros da clínica (para Equipe e para vincular aprendizes). */
export function useTeam() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['team', profile?.clinic_id],
    enabled: Boolean(profile?.clinic_id),
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, active, must_change_password, photo_path, created_at')
        .eq('clinic_id', profile!.clinic_id)
        .is('deleted_at', null)
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

type AdminAction =
  | { action: 'create'; full_name: string; email: string; role: UserRole; password: string }
  | { action: 'update'; user_id: string; full_name?: string; role?: UserRole }
  | { action: 'reset_password'; user_id: string; password: string }
  | { action: 'set_active'; user_id: string; active: boolean }

/** Chama a função do servidor que gerencia logins (a chave secreta fica só lá). */
async function callAdmin(body: AdminAction): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (!error) return data as { id: string }
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    const parsed = (await ctx.json().catch(() => null)) as { error?: string } | null
    if (parsed?.error) throw new Error(parsed.error)
  }
  if (error.message.toLowerCase().includes('fetch')) throw new Error('Sem conexão com a internet. Verifique e tente de novo.')
  throw new Error('Não foi possível concluir agora. Tente de novo em instantes.')
}

export function useAdminAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: callAdmin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team'] })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

/** Sugestão de senha provisória fácil de ditar: "Lova-4821-ab". */
export function suggestPassword(): string {
  const digits = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)
  const letters = Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => 'abcdefghjkmnpqrstuvwxyz'[b % 23]).join('')
  return `Lova-${digits}-${letters}`
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { UserRole } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

/** Texto exato do consentimento LGPD (o banco guarda a mesma cópia em cada registro). */
export const LGPD_CONSENT_TEXT =
  'Declaro que obtive o consentimento informado do responsável pelo(a) aprendiz para a coleta, armazenamento e uso de dados sensíveis, incluindo fotos, em conformidade com a LGPD.'

/** Nome exibido nas listas (respeita a preferência "exibir só as iniciais"). */
export function learnerListName(l: { full_name: string; initials: string }, initialsOnly: boolean) {
  return initialsOnly ? l.initials || '—' : l.full_name
}

export type LearnerListItem = {
  id: string
  full_name: string
  initials: string
  birth_date: string | null
  photo_path: string | null
  active: boolean
  created_at: string
  last_session_at: string | null
  sessions_count: number
}

export function useLearners() {
  return useQuery({ queryKey: ['learners'], queryFn: fetchLearners })
}

export async function fetchLearners(): Promise<LearnerListItem[]> {
  const { data, error } = await supabase
    .from('learner_overview')
    .select('id, full_name, initials, birth_date, photo_path, active, created_at, last_session_at, sessions_count')
    .order('full_name')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id!,
    full_name: r.full_name!,
    initials: r.initials ?? '',
    birth_date: r.birth_date,
    photo_path: r.photo_path,
    active: r.active ?? true,
    created_at: r.created_at!,
    last_session_at: r.last_session_at,
    sessions_count: r.sessions_count ?? 0,
  }))
}

export type CidCode = { id: string; code: string; description: string; clinic_id: string | null }

export function useCidCodes() {
  return useQuery({
    queryKey: ['cid-codes'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<CidCode[]> => {
      const { data, error } = await supabase.from('cid_codes').select('id, code, description, clinic_id').is('deleted_at', null).order('code')
      if (error) throw error
      return data
    },
  })
}

export type Guardian = { id: string; name: string; relationship: string | null; phone: string | null; email: string | null }
export type TeamLink = { profile_id: string; full_name: string; role: UserRole; photo_path: string | null; active: boolean }

export type LearnerDetail = {
  id: string
  full_name: string
  initials: string
  cpf: string | null
  birth_date: string | null
  photo_path: string | null
  notes: string | null
  active: boolean
  created_at: string
  cids: CidCode[]
  guardians: Guardian[]
  team: TeamLink[]
  consent: { accepted_at: string; registered_by: string; consent_text: string } | null
}

export function useLearner(id: string | undefined) {
  return useQuery({ queryKey: ['learner', id], enabled: Boolean(id), queryFn: () => fetchLearner(id!) })
}

export async function fetchLearner(id: string): Promise<LearnerDetail | null> {
  const { data, error } = await supabase
    .from('learners')
    .select(
      `id, full_name, initials, cpf, birth_date, photo_path, notes, active, created_at,
       learner_cids ( deleted_at, cid_codes ( id, code, description, clinic_id ) ),
       guardians ( id, name, relationship, phone, email, deleted_at, created_at ),
       learner_team ( deleted_at, profiles ( id, full_name, role, photo_path, active ) ),
       consents ( accepted_at, registered_by, consent_text, deleted_at )`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const consent = (data.consents ?? []).filter((c) => !c.deleted_at).sort((a, b) => a.accepted_at.localeCompare(b.accepted_at))[0]
  return {
    id: data.id,
    full_name: data.full_name,
    initials: data.initials,
    cpf: data.cpf,
    birth_date: data.birth_date,
    photo_path: data.photo_path,
    notes: data.notes,
    active: data.active,
    created_at: data.created_at,
    cids: (data.learner_cids ?? [])
      .filter((lc) => !lc.deleted_at && lc.cid_codes)
      .map((lc) => lc.cid_codes!)
      .sort((a, b) => a.code.localeCompare(b.code)),
    guardians: (data.guardians ?? [])
      .filter((g) => !g.deleted_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id: gid, name, relationship, phone, email }) => ({ id: gid, name, relationship, phone, email })),
    team: (data.learner_team ?? [])
      .filter((t) => !t.deleted_at && t.profiles)
      .map((t) => ({
        profile_id: t.profiles!.id,
        full_name: t.profiles!.full_name,
        role: t.profiles!.role,
        photo_path: t.profiles!.photo_path,
        active: t.profiles!.active,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    consent: consent ? { accepted_at: consent.accepted_at, registered_by: consent.registered_by, consent_text: consent.consent_text } : null,
  }
}

export type SaveLearnerInput = {
  id?: string
  full_name: string
  initials: string
  cpf: string | null
  birth_date: string | null
  notes: string | null
  active: boolean
  cid_ids: string[]
  team_ids: string[]
  guardians: { id?: string; name: string; relationship: string; phone: string; email: string }[]
  consent_accepted: boolean
}

/** Salva tudo de uma vez no banco (tudo ou nada). Devolve o id do aprendiz. */
export function useSaveLearner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveLearnerInput): Promise<string> => {
      const { data, error } = await supabase.rpc('save_learner', { p: input })
      if (error) throw error
      return data
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['learners'] }),
        queryClient.invalidateQueries({ queryKey: ['learner', id] }),
        queryClient.invalidateQueries({ queryKey: ['home-stats'] }),
      ])
    },
  })
}

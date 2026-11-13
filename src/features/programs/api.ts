import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Profile } from '@/features/auth/AuthProvider'
import type { LearnerDetail } from '@/features/learners/api'
import { supabase } from '@/lib/supabase'

import type { MeasureType, ProgramGoal, ProgramStatus, Protocol, TargetStatus } from './constants'

/** Coordenação, ou supervisão vinculada ao aprendiz (mesma regra do banco). */
export function canManageLearner(profile: Profile | null, learner: Pick<LearnerDetail, 'team'> | null | undefined): boolean {
  if (!profile || !learner) return false
  if (profile.role === 'coordenador') return true
  return profile.role === 'supervisor' && learner.team.some((t) => t.profile_id === profile.id)
}

export type ProgramListItem = {
  id: string
  name: string
  measure_type: MeasureType
  goal: ProgramGoal
  status: ProgramStatus
  category_name: string | null
  sort_order: number
  created_at: string
  counts: Record<TargetStatus, number>
}

export function useLearnerPrograms(learnerId: string | undefined) {
  return useQuery({
    queryKey: ['learner-programs', learnerId],
    enabled: Boolean(learnerId),
    queryFn: async (): Promise<ProgramListItem[]> => {
      const { data, error } = await supabase
        .from('learner_programs')
        .select('id, name, measure_type, goal, status, category_name, sort_order, created_at, targets ( status, deleted_at )')
        .eq('learner_id', learnerId!)
        .is('deleted_at', null)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data.map(({ targets, ...p }) => {
        const counts: Record<TargetStatus, number> = { intervencao: 0, fila: 0, manutencao: 0, masterizado: 0 }
        for (const t of targets ?? []) if (!t.deleted_at) counts[t.status] += 1
        return { ...p, counts }
      })
    },
  })
}

export type ProgramSessionStat = {
  learner_program_id: string
  session_id: string
  started_at: string
  session_status: string
  applicator_id: string
  trials_total: number
  correct_independent: number
  pct_independent: number | null
  occurrences: number
  value_total: number
}

/** Desempenho por programa e sessão (para os mini-gráficos e contagens). */
export function useProgramStats(learnerId: string | undefined) {
  return useQuery({
    queryKey: ['program-stats', learnerId],
    enabled: Boolean(learnerId),
    queryFn: async (): Promise<ProgramSessionStat[]> => {
      const { data, error } = await supabase
        .from('program_session_stats')
        .select('learner_program_id, session_id, started_at, session_status, applicator_id, trials_total, correct_independent, pct_independent, occurrences, value_total')
        .eq('learner_id', learnerId!)
        .order('started_at')
      if (error) throw error
      return data.map((r) => ({
        learner_program_id: r.learner_program_id!,
        session_id: r.session_id!,
        started_at: r.started_at!,
        session_status: r.session_status!,
        applicator_id: r.applicator_id!,
        trials_total: Number(r.trials_total ?? 0),
        correct_independent: Number(r.correct_independent ?? 0),
        pct_independent: r.pct_independent === null ? null : Number(r.pct_independent),
        occurrences: Number(r.occurrences ?? 0),
        value_total: Number(r.value_total ?? 0),
      }))
    },
  })
}

export type Target = {
  id: string
  name: string
  status: TargetStatus
  queue_position: number
  current_prompt_level_id: string | null
  maintenance_interval_days: number | null
  next_maintenance_date: string | null
  mastered_at: string | null
  created_at: string
}

export type ProgramDetail = {
  id: string
  learner_id: string
  template_id: string | null
  name: string
  objective: string | null
  procedure: string | null
  measure_type: MeasureType
  goal: ProgramGoal
  protocol: Protocol | null
  protocol_other: string | null
  category_name: string | null
  status: ProgramStatus
  mastery_min_pct: number
  mastery_sessions: number
  mastery_min_trials: number
  created_at: string
  targets: Target[]
}

export function useProgram(programId: string | undefined) {
  return useQuery({
    queryKey: ['program', programId],
    enabled: Boolean(programId),
    queryFn: async (): Promise<ProgramDetail | null> => {
      const { data, error } = await supabase
        .from('learner_programs')
        .select(
          `id, learner_id, template_id, name, objective, procedure, measure_type, goal, protocol, protocol_other, category_name, status,
           mastery_min_pct, mastery_sessions, mastery_min_trials, created_at,
           targets ( id, name, status, queue_position, current_prompt_level_id, maintenance_interval_days, next_maintenance_date, mastered_at, created_at, deleted_at )`,
        )
        .eq('id', programId!)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const { targets, ...p } = data
      return {
        ...p,
        targets: (targets ?? [])
          .filter((t) => !t.deleted_at)
          .map(({ deleted_at: _d, ...t }) => t)
          .sort((a, b) => a.queue_position - b.queue_position || a.created_at.localeCompare(b.created_at)),
      }
    },
  })
}

export type TargetSessionStat = {
  target_id: string
  /** nível de ajuda vigente naquela sessão */
  prompt_level_id: string | null
  session_id: string
  started_at: string
  session_status: string
  trials_total: number
  correct_independent: number
  pct_independent: number | null
  occurrences: number
  value_total: number
}

/** Resultado de cada alvo por sessão (mais recentes primeiro). */
export function useTargetStats(targetIds: string[]) {
  return useQuery({
    queryKey: ['target-stats', [...targetIds].sort().join(',')],
    enabled: targetIds.length > 0,
    queryFn: async (): Promise<TargetSessionStat[]> => {
      const { data, error } = await supabase
        .from('session_target_stats')
        .select('target_id, session_id, started_at, session_status, trials_total, correct_independent, pct_independent, occurrences, value_total, prompt_level_id')
        .in('target_id', targetIds)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data.map((r) => ({
        target_id: r.target_id!,
        prompt_level_id: r.prompt_level_id ?? null,
        session_id: r.session_id!,
        started_at: r.started_at!,
        session_status: r.session_status!,
        trials_total: Number(r.trials_total ?? 0),
        correct_independent: Number(r.correct_independent ?? 0),
        pct_independent: r.pct_independent === null ? null : Number(r.pct_independent),
        occurrences: Number(r.occurrences ?? 0),
        value_total: Number(r.value_total ?? 0),
      }))
    },
  })
}

/** Alvos com selo "Pronto para masterizar" (o sistema só sugere). */
export function useMastery(programId: string | undefined) {
  return useQuery({
    queryKey: ['mastery', programId],
    enabled: Boolean(programId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_mastery')
        .select('target_id, ready_to_master, sessions_meeting, sessions_considered')
        .eq('learner_program_id', programId!)
      if (error) throw error
      // Guarda uma lista simples (a cópia no aparelho só aceita dados simples)
      return data
    },
    select: (data) => new Map(data.map((m) => [m.target_id!, m])),
  })
}

export type HistoryEvent =
  | { kind: 'level'; id: string; target_id: string; at: string; by: string | null; from: string | null; to: string | null }
  | { kind: 'status'; id: string; target_id: string; at: string; by: string | null; from: TargetStatus | null; to: TargetStatus }

export function useProgramHistory(targetIds: string[]) {
  return useQuery({
    queryKey: ['program-history', [...targetIds].sort().join(',')],
    enabled: targetIds.length > 0,
    queryFn: async (): Promise<HistoryEvent[]> => {
      const [lv, st] = await Promise.all([
        supabase.from('target_prompt_history').select('id, target_id, from_level_id, to_level_id, changed_by, changed_at').in('target_id', targetIds),
        supabase.from('target_status_history').select('id, target_id, from_status, to_status, changed_by, changed_at').in('target_id', targetIds),
      ])
      if (lv.error) throw lv.error
      if (st.error) throw st.error
      const events: HistoryEvent[] = [
        ...lv.data.map((h) => ({ kind: 'level' as const, id: h.id, target_id: h.target_id, at: h.changed_at, by: h.changed_by, from: h.from_level_id, to: h.to_level_id })),
        ...st.data.map((h) => ({ kind: 'status' as const, id: h.id, target_id: h.target_id, at: h.changed_at, by: h.changed_by, from: h.from_status, to: h.to_status })),
      ]
      return events.sort((a, b) => b.at.localeCompare(a.at))
    },
  })
}

export type Playlist = { id: string; name: string; program_ids: string[] }

export function usePlaylists(learnerId: string | undefined) {
  return useQuery({
    queryKey: ['playlists', learnerId],
    enabled: Boolean(learnerId),
    queryFn: async (): Promise<Playlist[]> => {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, name, playlist_programs ( learner_program_id, sort_order, deleted_at )')
        .eq('learner_id', learnerId!)
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        program_ids: (p.playlist_programs ?? [])
          .filter((x) => !x.deleted_at)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((x) => x.learner_program_id),
      }))
    },
  })
}

// ---- Ações -----------------------------------------------------------------------

function useInvalidateProgram() {
  const queryClient = useQueryClient()
  return async (learnerId?: string, programId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['learner-programs', learnerId] }),
      programId ? queryClient.invalidateQueries({ queryKey: ['program', programId] }) : null,
      queryClient.invalidateQueries({ queryKey: ['mastery'] }),
      queryClient.invalidateQueries({ queryKey: ['ready-to-master'] }),
      queryClient.invalidateQueries({ queryKey: ['maintenance-due'] }),
      queryClient.invalidateQueries({ queryKey: ['program-history'] }),
      queryClient.invalidateQueries({ queryKey: ['playlists', learnerId] }),
    ])
  }
}

export type CreateProgramInput = {
  learner_id: string
  template_id: string | null
  name: string
  objective: string
  procedure: string
  measure_type: MeasureType
  goal: ProgramGoal
  protocol: Protocol | ''
  protocol_other: string
  category_name: string
  mastery_min_pct: number
  mastery_sessions: number
  mastery_min_trials: number
  targets: string[]
  start_count: number
  start_level_id: string | null
}

export function useCreateProgram() {
  const invalidate = useInvalidateProgram()
  return useMutation({
    mutationFn: async (input: CreateProgramInput) => {
      const { data, error } = await supabase.rpc('create_learner_program', { p: input })
      if (error) throw error
      return data
    },
    onSuccess: (_id, input) => invalidate(input.learner_id),
  })
}

export type UpdateProgramInput = Partial<
  Pick<
    ProgramDetail,
    | 'name'
    | 'objective'
    | 'procedure'
    | 'measure_type'
    | 'goal'
    | 'protocol'
    | 'protocol_other'
    | 'category_name'
    | 'status'
    | 'mastery_min_pct'
    | 'mastery_sessions'
    | 'mastery_min_trials'
  >
>

export function useUpdateProgram(learnerId: string, programId: string) {
  const invalidate = useInvalidateProgram()
  return useMutation({
    mutationFn: async (changes: UpdateProgramInput) => {
      const { error } = await supabase.from('learner_programs').update(changes).eq('id', programId)
      if (error) throw error
    },
    onSuccess: () => invalidate(learnerId, programId),
  })
}

export function useRemoveProgram(learnerId: string) {
  const invalidate = useInvalidateProgram()
  return useMutation({
    mutationFn: async (programId: string) => {
      const { error } = await supabase.from('learner_programs').update({ deleted_at: new Date().toISOString() }).eq('id', programId)
      if (error) throw error
    },
    onSuccess: () => invalidate(learnerId),
  })
}

export function useTargetActions(learnerId: string, programId: string) {
  const invalidate = useInvalidateProgram()
  const done = () => invalidate(learnerId, programId)

  const setStatus = useMutation({
    mutationFn: async (v: { targetId: string; status: TargetStatus; intervalDays?: number }) => {
      const { data, error } = await supabase.rpc('set_target_status', {
        p_target: v.targetId,
        p_status: v.status,
        ...(v.intervalDays ? { p_interval_days: v.intervalDays } : {}),
      })
      if (error) throw error
      return data as string | null
    },
    onSuccess: done,
  })

  const setLevel = useMutation({
    mutationFn: async (v: { targetId: string; levelId: string }) => {
      const { error } = await supabase.from('targets').update({ current_prompt_level_id: v.levelId }).eq('id', v.targetId)
      if (error) throw error
    },
    onSuccess: done,
  })

  const rename = useMutation({
    mutationFn: async (v: { targetId: string; name: string }) => {
      const { error } = await supabase.from('targets').update({ name: v.name.trim() }).eq('id', v.targetId)
      if (error) throw error
    },
    onSuccess: done,
  })

  const remove = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from('targets').update({ deleted_at: new Date().toISOString() }).eq('id', targetId)
      if (error) throw error
    },
    onSuccess: done,
  })

  const add = useMutation({
    mutationFn: async (v: { names: string[]; levelId: string | null }) => {
      const { data, error } = await supabase.rpc('add_targets', { p_program: programId, p_names: v.names, ...(v.levelId ? { p_level: v.levelId } : {}) })
      if (error) throw error
      return data
    },
    onSuccess: done,
  })

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_targets', { p_program: programId, p_ids: ids })
      if (error) throw error
    },
    onSuccess: done,
  })

  return { setStatus, setLevel, rename, remove, add, reorder }
}

export function useReorderPrograms(learnerId: string) {
  const invalidate = useInvalidateProgram()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_programs', { p_learner: learnerId, p_ids: ids })
      if (error) throw error
    },
    onSuccess: () => invalidate(learnerId),
  })
}

export function useSavePlaylist(learnerId: string) {
  const invalidate = useInvalidateProgram()
  return useMutation({
    mutationFn: async (v: { id?: string; name: string; program_ids: string[] }) => {
      const { data, error } = await supabase.rpc('save_playlist', { p: { ...v, learner_id: learnerId } })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(learnerId),
  })
}

export function useDeletePlaylist(learnerId: string) {
  const invalidate = useInvalidateProgram()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('playlists').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(learnerId),
  })
}

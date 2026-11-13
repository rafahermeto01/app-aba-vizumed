import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type SessionRow = {
  id: string
  number: number | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  status: 'em_andamento' | 'finalizada'
  rating: number | null
  notes: string | null
  applicator_id: string
  applicator_signature_path: string | null
  programs_count: number
  targets_count: number
  trials_total: number
  correct_independent: number
  prompted: number
  occurrences: number
}

const SESSION_COLUMNS =
  'id, number, started_at, ended_at, duration_seconds, status, rating, notes, applicator_id, applicator_signature_path, programs_count, targets_count, trials_total, correct_independent, prompted, occurrences'

function toRow(r: Record<string, unknown>): SessionRow {
  return {
    id: r.id as string,
    number: (r.number as number | null) ?? null,
    started_at: r.started_at as string,
    ended_at: (r.ended_at as string | null) ?? null,
    duration_seconds: (r.duration_seconds as number | null) ?? null,
    status: r.status as SessionRow['status'],
    rating: (r.rating as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    applicator_id: r.applicator_id as string,
    applicator_signature_path: (r.applicator_signature_path as string | null) ?? null,
    programs_count: Number(r.programs_count ?? 0),
    targets_count: Number(r.targets_count ?? 0),
    trials_total: Number(r.trials_total ?? 0),
    correct_independent: Number(r.correct_independent ?? 0),
    prompted: Number(r.prompted ?? 0),
    occurrences: Number(r.occurrences ?? 0),
  }
}

/** Todas as sessões do aprendiz (mais recentes primeiro). */
export function useLearnerSessions(learnerId: string | undefined) {
  return useQuery({
    queryKey: ['learner-sessions', learnerId],
    enabled: Boolean(learnerId),
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from('session_overview')
        .select(SESSION_COLUMNS)
        .eq('learner_id', learnerId!)
        .order('started_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return (data ?? []).map((r) => toRow(r as Record<string, unknown>))
    },
  })
}

export function useSessionRow(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<SessionRow | null> => {
      const { data, error } = await supabase.from('session_overview').select(SESSION_COLUMNS).eq('id', sessionId!).maybeSingle()
      if (error) throw error
      return data ? toRow(data as Record<string, unknown>) : null
    },
  })
}

/** Alvos masterizados e programas concluídos do aprendiz (para os números do período). */
export function useLearnerMilestones(learnerId: string | undefined) {
  return useQuery({
    queryKey: ['learner-milestones', learnerId],
    enabled: Boolean(learnerId),
    queryFn: async () => {
      const [mastered, concluded] = await Promise.all([
        supabase.from('target_status_history').select('target_id, changed_at').eq('learner_id', learnerId!).eq('to_status', 'masterizado'),
        supabase.from('learner_programs').select('id, updated_at').eq('learner_id', learnerId!).eq('status', 'concluido').is('deleted_at', null),
      ])
      if (mastered.error) throw mastered.error
      if (concluded.error) throw concluded.error
      return { mastered: mastered.data, concluded: concluded.data }
    },
  })
}

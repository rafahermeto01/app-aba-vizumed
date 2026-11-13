import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { MeasureType, ProgramGoal } from '@/features/programs/constants'
import { supabase } from '@/lib/supabase'

export type DetailTrial = {
  id: string
  target_id: string
  result: 'acerto' | 'erro' | 'dica' | null
  prompt_level_id: string | null
  help_level_id: string | null
  value: number | null
  recorded_at: string
  deleted_at: string | null
}

export type DetailProgram = { id: string; name: string; goal: ProgramGoal; measure_type: MeasureType; targets: { id: string; name: string }[] }

export type AuditRow = {
  id: string
  table_name: string
  record_id: string
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

/** Tentativas, programas e correções de uma sessão. */
export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-detail', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const [trials, sps, audit] = await Promise.all([
        supabase
          .from('trials')
          .select('id, target_id, result, prompt_level_id, help_level_id, value, recorded_at, deleted_at')
          .eq('session_id', sessionId!)
          .order('recorded_at'),
        supabase.from('session_programs').select('learner_program_id').eq('session_id', sessionId!).is('deleted_at', null),
        supabase
          .from('session_audit')
          .select('id, table_name, record_id, action, old_data, new_data, changed_by, changed_at')
          .eq('session_id', sessionId!)
          .order('changed_at', { ascending: false }),
      ])
      if (trials.error) throw trials.error
      if (sps.error) throw sps.error
      if (audit.error) throw audit.error
      const programIds = [...new Set(sps.data.map((x) => x.learner_program_id))]
      let programs: DetailProgram[] = []
      if (programIds.length) {
        const res = await supabase.from('learner_programs').select('id, name, goal, measure_type, sort_order, targets ( id, name )').in('id', programIds).order('sort_order')
        if (res.error) throw res.error
        programs = res.data.map(({ sort_order: _s, ...p }) => p)
      }
      return { trials: trials.data as DetailTrial[], programs, audit: audit.data as AuditRow[] }
    },
  })
}

/** Correções da supervisão/coordenação (o banco registra na auditoria). */
export function useSessionCorrections(sessionId: string, learnerId: string) {
  const queryClient = useQueryClient()
  const refresh = async () => {
    await Promise.all(
      [['session', sessionId], ['session-detail', sessionId], ['learner-sessions', learnerId], ['program-stats', learnerId], ['target-stats'], ['mastery'], ['ready-to-master']].map((k) =>
        queryClient.invalidateQueries({ queryKey: k }),
      ),
    )
  }

  const updateSession = useMutation({
    mutationFn: async (changes: { notes?: string | null; rating?: number | null; deleted_at?: string }) => {
      const { error } = await supabase.from('sessions').update(changes).eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const updateTrial = useMutation({
    mutationFn: async (v: { trial: DetailTrial; result?: 'acerto' | 'erro' | 'dica'; remove?: boolean; restore?: boolean }) => {
      const changes: { result?: 'acerto' | 'erro' | 'dica'; help_level_id?: string | null; deleted_at?: string | null } = {}
      if (v.result) {
        changes.result = v.result
        // DICA guarda a ajuda usada; os outros não
        changes.help_level_id = v.result === 'dica' ? (v.trial.help_level_id ?? v.trial.prompt_level_id) : null
      }
      if (v.remove) changes.deleted_at = new Date().toISOString()
      if (v.restore) changes.deleted_at = null
      const { error } = await supabase.from('trials').update(changes).eq('id', v.trial.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  return { updateSession, updateTrial }
}

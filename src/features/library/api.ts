import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { MeasureType, ProgramGoal, Protocol } from '@/features/programs/constants'
import { supabase } from '@/lib/supabase'

export type Category = { id: string; name: string; sort_order: number }

export function useCategories() {
  return useQuery({
    queryKey: ['program-categories'],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('program_categories')
        .select('id, name, sort_order')
        .is('deleted_at', null)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export type TemplateListItem = {
  id: string
  name: string
  objective: string | null
  measure_type: MeasureType
  goal: ProgramGoal
  protocol: Protocol | null
  protocol_other: string | null
  category_id: string | null
  targets_count: number
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<TemplateListItem[]> => {
      const { data, error } = await supabase
        .from('program_templates')
        .select('id, name, objective, measure_type, goal, protocol, protocol_other, category_id, template_targets ( id, deleted_at )')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return data.map(({ template_targets, ...t }) => ({ ...t, targets_count: (template_targets ?? []).filter((x) => !x.deleted_at).length }))
    },
  })
}

export type TemplateDetail = Omit<TemplateListItem, 'targets_count'> & {
  procedure: string | null
  mastery_min_pct: number
  mastery_sessions: number
  mastery_min_trials: number
  targets: { id: string; name: string }[]
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['template', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<TemplateDetail | null> => {
      const { data, error } = await supabase
        .from('program_templates')
        .select(
          'id, name, objective, procedure, measure_type, goal, protocol, protocol_other, category_id, mastery_min_pct, mastery_sessions, mastery_min_trials, template_targets ( id, name, sort_order, deleted_at )',
        )
        .eq('id', id!)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const { template_targets, ...t } = data
      return {
        ...t,
        targets: (template_targets ?? [])
          .filter((x) => !x.deleted_at)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(({ id: tid, name }) => ({ id: tid, name })),
      }
    },
  })
}

export type SaveTemplateInput = {
  id?: string
  name: string
  objective: string
  procedure: string
  measure_type: MeasureType
  goal: ProgramGoal
  protocol: Protocol | ''
  protocol_other: string
  category_id: string | null
  mastery_min_pct: number
  mastery_sessions: number
  mastery_min_trials: number
  targets: { id?: string; name: string }[]
}

export function useSaveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveTemplateInput) => {
      const { data, error } = await supabase.rpc('save_template', { p: input })
      if (error) throw error
      return data
    },
    onSuccess: async (id) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['templates'] }), queryClient.invalidateQueries({ queryKey: ['template', id] })])
    },
  })
}

/** Arquivar (exclusão lógica): some da biblioteca, mas os programas copiados dele continuam. */
export function useArchiveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('program_templates').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })
}

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useAuth } from '@/features/auth/AuthProvider'
import { fetchLearner, fetchLearners } from '@/features/learners/api'
import type { MeasureType, ProgramGoal, TargetStatus } from '@/features/programs/constants'
import { todayIso } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { SnapshotProgram, SnapshotTarget } from '@/offline/db'

export type BundleTarget = {
  id: string
  name: string
  status: TargetStatus
  current_prompt_level_id: string | null
  next_maintenance_date: string | null
  queue_position: number
}

export type BundleProgram = {
  id: string
  name: string
  goal: ProgramGoal
  measure_type: MeasureType
  sort_order: number
  targets: BundleTarget[]
}

export type CollectionBundle = {
  learner: { id: string; full_name: string; initials: string; clinic_id: string }
  programs: BundleProgram[]
  playlists: { id: string; name: string; program_ids: string[] }[]
  lastSession: { started_at: string; applicator_id: string; program_ids: string[] } | null
  /** última aplicação de cada programa */
  programLast: Record<string, { at: string; applicator_id: string }>
  /** quem já aplicou cada programa */
  programApplicators: Record<string, string[]>
  fetched_at: string
}

/** Tudo o que a coleta precisa de um aprendiz, num pacote só (fica guardado no aparelho). */
export async function fetchCollectionBundle(learnerId: string): Promise<CollectionBundle> {
  const [learner, programs, playlists, last, stats] = await Promise.all([
    supabase.from('learners').select('id, full_name, initials, clinic_id').eq('id', learnerId).single(),
    supabase
      .from('learner_programs')
      .select('id, name, goal, measure_type, sort_order, targets ( id, name, status, current_prompt_level_id, next_maintenance_date, queue_position, deleted_at )')
      .eq('learner_id', learnerId)
      .eq('status', 'ativo')
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('playlists')
      .select('id, name, playlist_programs ( learner_program_id, sort_order, deleted_at )')
      .eq('learner_id', learnerId)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('sessions')
      .select('started_at, applicator_id, session_programs ( learner_program_id, deleted_at )')
      .eq('learner_id', learnerId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('program_session_stats').select('learner_program_id, started_at, applicator_id').eq('learner_id', learnerId),
  ])
  for (const r of [learner, programs, playlists, last, stats]) if (r.error) throw r.error

  const programLast: CollectionBundle['programLast'] = {}
  const programApplicators: CollectionBundle['programApplicators'] = {}
  for (const s of stats.data ?? []) {
    const pid = s.learner_program_id!
    if (!programLast[pid] || s.started_at! > programLast[pid].at) programLast[pid] = { at: s.started_at!, applicator_id: s.applicator_id! }
    const list = (programApplicators[pid] ??= [])
    if (!list.includes(s.applicator_id!)) list.push(s.applicator_id!)
  }

  return {
    learner: learner.data!,
    programs: (programs.data ?? []).map(({ targets, ...p }) => ({
      ...p,
      targets: (targets ?? [])
        .filter((t) => !t.deleted_at)
        .map(({ deleted_at: _d, ...t }) => t)
        .sort((a, b) => a.queue_position - b.queue_position),
    })),
    playlists: (playlists.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      program_ids: (p.playlist_programs ?? [])
        .filter((x) => !x.deleted_at)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((x) => x.learner_program_id),
    })),
    lastSession: last.data
      ? {
          started_at: last.data.started_at,
          applicator_id: last.data.applicator_id,
          program_ids: (last.data.session_programs ?? []).filter((x) => !x.deleted_at).map((x) => x.learner_program_id),
        }
      : null,
    programLast,
    programApplicators,
    fetched_at: new Date().toISOString(),
  }
}

export function useCollectionBundle(learnerId: string | undefined) {
  return useQuery({
    queryKey: ['collection-bundle', learnerId],
    enabled: Boolean(learnerId),
    queryFn: () => fetchCollectionBundle(learnerId!),
  })
}

/**
 * Alvos que entram na coleta: em intervenção, e em manutenção quando chegou
 * a data da revisão (com a etiqueta "Manutenção").
 */
export function collectibleTargets(p: BundleProgram, today = todayIso()): SnapshotTarget[] {
  return p.targets
    .filter((t) => t.status === 'intervencao' || (t.status === 'manutencao' && (!t.next_maintenance_date || t.next_maintenance_date <= today)))
    .map((t) => ({ id: t.id, name: t.name, phase: t.status as 'intervencao' | 'manutencao', level_id: t.current_prompt_level_id }))
}

export function toSnapshot(p: BundleProgram): SnapshotProgram {
  return { id: p.id, name: p.name, goal: p.goal, measure_type: p.measure_type, targets: collectibleTargets(p) }
}

const PREFETCH_EVERY_MS = 10 * 60_000
let lastPrefetch = 0

/**
 * Com internet, baixa para o aparelho os aprendizes que a pessoa atende e tudo o
 * que a coleta precisa deles. Assim, depois do primeiro acesso, a coleta funciona
 * mesmo sem internet.
 */
export function useOfflinePrefetch() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!profile || profile.must_change_password || !profile.active) return
    const run = async () => {
      if (!navigator.onLine || Date.now() - lastPrefetch < PREFETCH_EVERY_MS) return
      lastPrefetch = Date.now()
      try {
        const team = await supabase.from('learner_team').select('learner_id, learners ( active, deleted_at )').eq('profile_id', profile.id).is('deleted_at', null)
        if (team.error) return
        const ids = (team.data ?? []).filter((t) => t.learners?.active && !t.learners.deleted_at).map((t) => t.learner_id)
        await queryClient.prefetchQuery({ queryKey: ['learners'], queryFn: fetchLearners })
        for (const id of ids) {
          await queryClient.prefetchQuery({ queryKey: ['learner', id], queryFn: () => fetchLearner(id) })
          await queryClient.prefetchQuery({ queryKey: ['collection-bundle', id], queryFn: () => fetchCollectionBundle(id) })
        }
      } catch {
        // sem internet no meio do caminho: tenta na próxima vez
      }
    }
    void run()
    const onOnline = () => {
      lastPrefetch = 0
      void run()
    }
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => void run(), PREFETCH_EVERY_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(timer)
    }
  }, [profile, queryClient])
}

import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Sparkles, Wrench } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { learnerListName } from '@/features/learners/api'
import { useClinic } from '@/features/settings/useClinic'
import { formatDateOnly, todayIso } from '@/lib/dates'
import { supabase } from '@/lib/supabase'

type TargetItem = {
  id: string
  name: string
  learner_id: string
  learner_program_id: string
  program_name: string
  learner_name: string
  learner_initials: string
  next_maintenance_date?: string | null
}

const TARGET_SELECT = 'id, name, learner_id, learner_program_id, next_maintenance_date, learner_programs ( name, status, deleted_at ), learners ( full_name, initials, active, deleted_at )'

type RawTarget = {
  id: string
  name: string
  learner_id: string
  learner_program_id: string
  next_maintenance_date: string | null
  learner_programs: { name: string; status: string; deleted_at: string | null } | null
  learners: { full_name: string; initials: string; active: boolean; deleted_at: string | null } | null
}

const toItem = (t: RawTarget): TargetItem => ({
  id: t.id,
  name: t.name,
  learner_id: t.learner_id,
  learner_program_id: t.learner_program_id,
  program_name: t.learner_programs?.name ?? 'Programa',
  learner_name: t.learners?.full_name ?? '',
  learner_initials: t.learners?.initials ?? '',
  next_maintenance_date: t.next_maintenance_date,
})

const alive = (t: RawTarget) => t.learner_programs && !t.learner_programs.deleted_at && t.learner_programs.status === 'ativo' && t.learners?.active && !t.learners.deleted_at

/** Alvos com o selo "Pronto para masterizar" (o sistema só sugere). */
export function useReadyToMaster(enabled: boolean) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['ready-to-master', profile?.id],
    enabled,
    queryFn: async (): Promise<TargetItem[]> => {
      const ready = await supabase.from('target_mastery').select('target_id').eq('ready_to_master', true)
      if (ready.error) throw ready.error
      const ids = ready.data.map((r) => r.target_id!).filter(Boolean)
      if (!ids.length) return []
      const res = await supabase.from('targets').select(TARGET_SELECT).in('id', ids).is('deleted_at', null)
      if (res.error) throw res.error
      return (res.data as unknown as RawTarget[]).filter(alive).map(toItem)
    },
  })
}

/** Alvos em manutenção com revisão para hoje (ou atrasada). */
export function useMaintenanceDue() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['maintenance-due', profile?.id, todayIso()],
    queryFn: async (): Promise<TargetItem[]> => {
      const res = await supabase
        .from('targets')
        .select(TARGET_SELECT)
        .eq('status', 'manutencao')
        .lte('next_maintenance_date', todayIso())
        .is('deleted_at', null)
        .order('next_maintenance_date')
      if (res.error) throw res.error
      return (res.data as unknown as RawTarget[]).filter(alive).map(toItem)
    },
  })
}

function TargetList({ items, initialsOnly, hrefSuffix, extra }: { items: TargetItem[]; initialsOnly: boolean; hrefSuffix?: string; extra?: (t: TargetItem) => string | null }) {
  return (
    <ul className="flex flex-col divide-y">
      {items.slice(0, 12).map((t) => (
        <li key={t.id}>
          <Link
            to={`/aprendizes/${t.learner_id}/programas/${t.learner_program_id}${hrefSuffix ?? ''}`}
            className="flex min-h-14 items-center gap-3 rounded-lg px-1 py-2 hover:bg-muted/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium">{t.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {learnerListName({ full_name: t.learner_name, initials: t.learner_initials }, initialsOnly)} · {t.program_name}
                {extra?.(t) ? ` · ${extra(t)}` : ''}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
      {items.length > 12 && <li className="py-2 text-sm text-muted-foreground">e mais {items.length - 12}…</li>}
    </ul>
  )
}

export function ReadyToMasterCard() {
  const clinic = useClinic()
  const ready = useReadyToMaster(true)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden /> Prontos para masterizar
          {ready.data && <span className="font-normal text-muted-foreground">({ready.data.length})</span>}
        </CardTitle>
        <CardDescription className="text-base">Alvos que atingiram o critério de maestria. O sistema só sugere: quem decide é a supervisão.</CardDescription>
      </CardHeader>
      <CardContent>
        {ready.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : ready.isError ? (
          <p className="text-base text-muted-foreground">Não foi possível carregar agora.</p>
        ) : ready.data.length === 0 ? (
          <p className="text-base text-muted-foreground">Nenhum alvo pronto no momento.</p>
        ) : (
          <TargetList items={ready.data} initialsOnly={clinic.data?.show_initials_only ?? false} />
        )}
      </CardContent>
    </Card>
  )
}

export function MaintenanceDueCard() {
  const clinic = useClinic()
  const due = useMaintenanceDue()
  if (due.isPending || due.isError || due.data.length === 0) return null
  const today = todayIso()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="size-5 text-primary" aria-hidden /> Revisões de manutenção <span className="font-normal text-muted-foreground">({due.data.length})</span>
        </CardTitle>
        <CardDescription className="text-base">Alvos já dominados que voltam para a coleta hoje (aparecem com a etiqueta “Manutenção”).</CardDescription>
      </CardHeader>
      <CardContent>
        <TargetList
          items={due.data}
          initialsOnly={clinic.data?.show_initials_only ?? false}
          extra={(t) => (t.next_maintenance_date && t.next_maintenance_date < today ? `revisão desde ${formatDateOnly(t.next_maintenance_date)}` : null)}
        />
      </CardContent>
    </Card>
  )
}

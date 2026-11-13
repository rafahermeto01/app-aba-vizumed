import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Sparkles, Users } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthProvider'
import { InstallBanner } from '@/pwa/InstallHelp'

import { MaintenanceDueCard, ReadyToMasterCard, useReadyToMaster } from './HomeLists'
import { formatDateTime, greeting, timeAgo } from '@/lib/dates'
import { supabase } from '@/lib/supabase'

export function HomePage() {
  const { profile } = useAuth()

  const stats = useQuery({
    queryKey: ['home-stats', profile?.id],
    queryFn: async () => {
      // As regras do banco já filtram: cada pessoa só conta os aprendizes que pode ver.
      const learners = await supabase.from('learners').select('id', { count: 'exact', head: true }).eq('active', true).is('deleted_at', null)
      if (learners.error) throw learners.error
      const last = await supabase
        .from('sessions')
        .select('started_at')
        .eq('status', 'finalizada')
        .is('deleted_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (last.error) throw last.error
      return { learners: learners.count ?? 0, lastSession: last.data as { started_at: string } | null }
    },
  })

  const manages = profile?.role !== 'aplicador'
  const ready = useReadyToMaster(Boolean(profile) && manages)
  const firstName = profile?.full_name.split(' ')[0] ?? ''

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}!`} description="Este é o resumo da clínica." />
      <InstallBanner />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2 text-base">
              <Users className="size-5" aria-hidden /> Aprendizes ativos
            </CardDescription>
            <CardTitle className="text-4xl">{stats.isPending ? '…' : (stats.data?.learners ?? '—')}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2 text-base">
              <CalendarClock className="size-5" aria-hidden /> Última sessão realizada
            </CardDescription>
            <CardTitle className="text-2xl">
              {stats.isPending ? '…' : stats.data?.lastSession ? timeAgo(stats.data.lastSession.started_at) : 'Nenhuma ainda'}
            </CardTitle>
            {stats.data?.lastSession && (
              <p className="text-sm text-muted-foreground">{formatDateTime(stats.data.lastSession.started_at)}</p>
            )}
          </CardHeader>
        </Card>

        {profile?.role !== 'aplicador' && (
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2 text-base">
                <Sparkles className="size-5" aria-hidden /> Prontos para masterizar
              </CardDescription>
              <CardTitle className="text-4xl">{ready.isPending ? '…' : (ready.data?.length ?? '—')}</CardTitle>
              <p className="text-sm text-muted-foreground">alvos atingiram o critério</p>
            </CardHeader>
          </Card>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {manages && <ReadyToMasterCard />}
        <MaintenanceDueCard />
      </div>

      {stats.isError && (
        <Card className="mt-6">
          <CardContent className="text-base text-muted-foreground">Não foi possível carregar o resumo agora. Verifique sua conexão.</CardContent>
        </Card>
      )}
    </>
  )
}

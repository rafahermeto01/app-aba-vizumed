import { Construction } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamSection } from '@/features/team/TeamSection'

import { CidSection } from './CidSection'
import { ClinicSection } from './ClinicSection'

const TABS = ['clinica', 'equipe', 'cids', 'niveis'] as const
type Tab = (typeof TABS)[number]

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const current = (TABS as readonly string[]).includes(params.get('aba') ?? '') ? (params.get('aba') as Tab) : 'clinica'

  return (
    <>
      <PageHeader title="Configurações" />
      <Tabs value={current} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <TabsList>
            <TabsTrigger value="clinica">Clínica</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="cids">CIDs</TabsTrigger>
            <TabsTrigger value="niveis">Níveis de ajuda</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="clinica" className="mt-4">
          <ClinicSection />
        </TabsContent>
        <TabsContent value="equipe" className="mt-4">
          <TeamSection />
        </TabsContent>
        <TabsContent value="cids" className="mt-4">
          <CidSection />
        </TabsContent>
        <TabsContent value="niveis" className="mt-4">
          <Card className="max-w-3xl">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Construction className="size-10 text-muted-foreground" aria-hidden />
              <p className="text-lg font-medium">Chega na fase 3</p>
              <p className="max-w-md text-base text-muted-foreground">Reordenar, renomear e escolher as cores dos níveis de ajuda.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

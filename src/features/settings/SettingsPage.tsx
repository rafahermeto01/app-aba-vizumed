import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamSection } from '@/features/team/TeamSection'

import { CidSection } from './CidSection'
import { ClinicSection } from './ClinicSection'
import { PromptLevelsSection } from './PromptLevelsSection'

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
          <PromptLevelsSection />
        </TabsContent>
      </Tabs>
    </>
  )
}

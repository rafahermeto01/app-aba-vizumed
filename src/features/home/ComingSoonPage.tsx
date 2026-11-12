import { Construction } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

/** Tela provisória para áreas das próximas fases. */
export function ComingSoonPage({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Construction className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-lg font-medium">Em construção (fase {phase})</p>
          <p className="max-w-md text-base text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </>
  )
}

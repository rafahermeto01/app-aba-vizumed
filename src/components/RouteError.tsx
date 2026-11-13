import { House, RefreshCw } from 'lucide-react'
import { useRouteError } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Tela amigável quando algo inesperado acontece numa página (nunca mostrar erro
 * técnico para a equipe). Os registros da coleta continuam salvos no aparelho.
 */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo size="lg" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Algo deu errado nesta tela</CardTitle>
          <CardDescription className="text-base">
            Nada do que você registrou foi perdido: os dados da coleta ficam salvos no aparelho. Tente recarregar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden /> Recarregar
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.location.assign('/')}>
            <House aria-hidden /> Voltar ao início
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

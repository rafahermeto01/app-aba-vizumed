import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useUpdate } from './pwa'

/**
 * "Nova versão disponível". Aparece só nas telas comuns (nunca durante a coleta),
 * e só atualiza quando a pessoa toca em Atualizar.
 */
export function UpdateBanner() {
  const update = useUpdate()
  if (!update.needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card p-3 shadow-lg md:bottom-6">
      <RefreshCw className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-base">Nova versão do LovABA disponível.</p>
      <Button variant="ghost" onClick={update.dismiss}>
        Depois
      </Button>
      <Button onClick={update.apply}>Atualizar</Button>
    </div>
  )
}

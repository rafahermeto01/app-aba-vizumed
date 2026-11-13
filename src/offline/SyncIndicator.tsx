import { CloudOff, Loader2, CircleCheck, TriangleAlert } from 'lucide-react'

import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'

import { useSyncStatus } from './hooks'

const LABEL = {
  saved: 'Salvo',
  syncing: 'Salvo no aparelho, sincronizando…',
  offline: 'Sem internet, salvo no aparelho',
  error: 'Salvo no aparelho, aguardando envio',
} as const

/**
 * Indicador sempre visível na coleta. Verde = tudo no servidor; amarelo = salvo
 * no aparelho e enviando; cinza = sem internet (salvo no aparelho).
 * `compact` mostra só quando há algo pendente ou sem internet (para o menu).
 */
export function SyncIndicator({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { profile } = useAuth()
  const { state, pending } = useSyncStatus(profile?.id)
  if (compact && state === 'saved') return null
  const Icon = state === 'saved' ? CircleCheck : state === 'offline' ? CloudOff : state === 'error' ? TriangleAlert : Loader2
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        state === 'saved' && 'bg-acerto/15 text-acerto-strong',
        state === 'syncing' && 'bg-dica/25 text-dica-strong',
        state === 'offline' && 'bg-muted text-muted-foreground',
        state === 'error' && 'bg-dica/25 text-dica-strong',
        className,
      )}
      title={pending ? `${pending} registro(s) aguardando envio` : undefined}
    >
      <Icon className={cn('size-4 shrink-0', state === 'syncing' && 'animate-spin')} aria-hidden />
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>{LABEL[state]}</span>
    </span>
  )
}

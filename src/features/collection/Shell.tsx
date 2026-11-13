import { useEffect, type ReactNode } from 'react'

import { SyncIndicator } from '@/offline/SyncIndicator'

/** Moldura das telas de coleta: tela cheia, rodapé fixo com o botão principal. */
export function Shell({
  back,
  title,
  subtitle,
  children,
  footer,
  showSaved = false,
}: {
  back?: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  /** mostra o indicador mesmo quando está tudo salvo (no resumo da sessão) */
  showSaved?: boolean
}) {
  useEffect(() => {
    document.title = `${title} · LovABA`
  }, [title])
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          {back}
          <SyncIndicator compact={!showSaved} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-4 pb-40">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </main>
      {footer && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-2xl">{footer}</div>
        </footer>
      )}
    </div>
  )
}

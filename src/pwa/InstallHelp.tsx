import { Download, EllipsisVertical, MonitorDown, Share, SquarePlus, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { useInstall } from './pwa'

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span>
      <span className="pt-0.5 text-base">{children}</span>
    </li>
  )
}

/** Passo a passo para instalar o LovABA como aplicativo (Android, iPhone, computador). */
export function InstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const install = useInstall()
  const [result, setResult] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Instalar o LovABA</DialogTitle>
          <DialogDescription className="text-base">
            Fica com ícone na tela inicial, abre em tela cheia e funciona sem internet. Não precisa de loja de aplicativos.
          </DialogDescription>
        </DialogHeader>

        {install.installed ? (
          <p className="rounded-xl bg-muted/50 p-4 text-base">O LovABA já está instalado neste aparelho. 🎉</p>
        ) : install.canPrompt ? (
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="h-14 text-lg"
              onClick={async () => {
                const ok = await install.prompt()
                setResult(ok ? 'Pronto! O ícone do LovABA está na sua tela inicial.' : 'Instalação cancelada. Você pode instalar depois por aqui.')
              }}
            >
              <Download aria-hidden /> Instalar agora
            </Button>
            {result && <p className="text-base text-muted-foreground">{result}</p>}
          </div>
        ) : install.platform === 'ios' ? (
          <ol className="flex flex-col gap-4">
            <Step n={1}>
              Abra o LovABA no <strong>Safari</strong> (no iPhone, a instalação só funciona pelo Safari).
            </Step>
            <Step n={2}>
              Toque no botão <strong>Compartilhar</strong> <Share className="inline size-5 align-text-bottom" aria-label="(ícone de compartilhar)" /> na barra
              de baixo.
            </Step>
            <Step n={3}>
              Role e toque em <strong>Adicionar à Tela de Início</strong>{' '}
              <SquarePlus className="inline size-5 align-text-bottom" aria-label="(ícone de adicionar)" />.
            </Step>
            <Step n={4}>
              Toque em <strong>Adicionar</strong>. O ícone do LovABA aparece na tela de início.
            </Step>
          </ol>
        ) : install.platform === 'android' ? (
          <ol className="flex flex-col gap-4">
            <Step n={1}>
              Abra o LovABA no <strong>Chrome</strong>.
            </Step>
            <Step n={2}>
              Toque no menu <EllipsisVertical className="inline size-5 align-text-bottom" aria-label="(três pontinhos)" /> no canto de cima.
            </Step>
            <Step n={3}>
              Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>) e confirme.
            </Step>
          </ol>
        ) : (
          <ol className="flex flex-col gap-4">
            <Step n={1}>
              No <strong>Chrome</strong> ou no <strong>Edge</strong>, procure o ícone{' '}
              <MonitorDown className="inline size-5 align-text-bottom" aria-label="(ícone de instalar)" /> no fim da barra de endereço.
            </Step>
            <Step n={2}>
              Clique nele e em <strong>Instalar</strong>. (Ou abra o menu do navegador e escolha <strong>Instalar LovABA</strong>.)
            </Step>
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}

const DISMISS_KEY = 'lovaba-install-banner-dismissed'

/** Aviso na tela inicial (só no celular, só se ainda não instalou e não dispensou). */
export function InstallBanner() {
  const install = useInstall()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  if (install.installed || dismissed || install.platform === 'desktop') return null
  return (
    <>
      <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 rounded-xl border bg-card p-3 sm:flex">
        <img src="/icons/icon-192.png" alt="" className="size-11 rounded-xl" />
        <p className="text-base sm:flex-1">Instale o LovABA no celular: abre mais rápido e funciona sem internet.</p>
        <Button className="col-span-3 row-start-2 sm:order-last sm:col-auto" onClick={() => setOpen(true)}>
          Instalar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dispensar aviso de instalação"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              // navegação privada: só some até recarregar
            }
          }}
        >
          <X aria-hidden />
        </Button>
      </div>
      <InstallDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

// PWA: instalação (ícone na tela inicial) e atualização com aviso.
import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

type State = {
  /** o navegador ofereceu instalar (Android/Chrome/Edge) */
  installEvent: InstallPromptEvent | null
  installed: boolean
  needRefresh: boolean
}

let state: State = { installEvent: null, installed: false, needRefresh: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null

/** Chamado uma vez ao abrir o app (antes do React), para não perder o aviso do navegador. */
export function initPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // nós mostramos o botão "Instalar" na hora certa
    set({ installEvent: e as InstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => set({ installed: true, installEvent: null }))
  if (!('serviceWorker' in navigator)) return
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ needRefresh: true }),
    onRegisteredSW: (_url, registration) => {
      // procura versão nova a cada hora (e quando a internet volta)
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined)
      }
      setInterval(check, 60 * 60 * 1000)
      window.addEventListener('online', check)
    },
  })
}

function usePwaState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOs) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

export function useInstall() {
  const s = usePwaState()
  const installed = s.installed || isStandalone()
  return {
    installed,
    platform: detectPlatform(),
    canPrompt: Boolean(s.installEvent) && !installed,
    async prompt() {
      const ev = s.installEvent
      if (!ev) return false
      await ev.prompt()
      const choice = await ev.userChoice
      set({ installEvent: null, installed: choice.outcome === 'accepted' || state.installed })
      return choice.outcome === 'accepted'
    },
  }
}

export function useUpdate() {
  const s = usePwaState()
  return {
    needRefresh: s.needRefresh,
    /** troca para a versão nova e recarrega */
    apply: () => void updateSW?.(true),
    dismiss: () => set({ needRefresh: false }),
  }
}

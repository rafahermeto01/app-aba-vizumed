import { useEffect, useState } from 'react'

/** Mantém a tela acesa durante a coleta (quando o aparelho permite). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // sem permissão / bateria fraca: segue sem manter a tela acesa
      }
    }
    void request()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}

/** Vibração curta a cada toque, quando o aparelho suporta. */
export function vibrate(pattern: number | number[] = 15) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // alguns navegadores bloqueiam: sem problema
  }
}

/** Relógio que atualiza a cada `ms` (para cronômetros na tela). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Avisa antes de fechar/recarregar a aba com sessão em andamento. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])
}

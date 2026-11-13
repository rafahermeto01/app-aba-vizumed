import { useCallback, useRef } from 'react'
import { useBlocker } from 'react-router'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Pergunta "Sair sem salvar?" quando a pessoa tenta sair de um formulário com
 * alterações. Chame `allowLeave()` logo antes de navegar depois de salvar.
 */
export function useUnsavedGuard(dirty: boolean) {
  const allowed = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname)
  const allowLeave = useCallback(() => {
    allowed.current = true
  }, [])

  const dialog = (
    <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
          <AlertDialogDescription className="text-base">As alterações feitas neste formulário serão perdidas.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.state === 'blocked' && blocker.reset()}>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.state === 'blocked' && blocker.proceed()}>Sair sem salvar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  return { dialog, allowLeave }
}

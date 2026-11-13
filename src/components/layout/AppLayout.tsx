import { LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABEL, useAuth } from '@/features/auth/AuthProvider'
import { useOfflinePrefetch } from '@/features/collection/api'
import { OpenSessionBanner } from '@/features/collection/OpenSessionBanner'
import { useClinic } from '@/features/settings/useClinic'
import { pendingCount } from '@/offline'
import { SyncIndicator } from '@/offline/SyncIndicator'
import { cn } from '@/lib/utils'

import { navFor } from './nav'

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [pendingToLeave, setPendingToLeave] = useState<number | null>(null)
  if (!profile) return null

  async function trySignOut() {
    // Registros que ainda não chegaram ao servidor só podem ser enviados por quem os fez
    const n = await pendingCount(profile!.id)
    if (n > 0) setPendingToLeave(n)
    else await signOut()
  }
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn('h-auto gap-3 px-2 py-2', compact ? '' : 'w-full justify-start')} aria-label="Menu da conta">
          <PersonAvatar name={profile.full_name} photoPath={profile.photo_path} bucket="profile-photos" className="size-9" />
          {!compact && (
            <span className="flex min-w-0 flex-col items-start text-left">
              <span className="truncate text-sm font-medium">{profile.full_name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABEL[profile.role]}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span>{profile.full_name}</span>
          <span className="text-xs font-normal text-muted-foreground">{profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/perfil')} className="text-base md:text-sm">
          <UserRound aria-hidden /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void trySignOut()} className="text-base md:text-sm">
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={pendingToLeave !== null} onOpenChange={(o) => !o && setPendingToLeave(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ainda há registros para enviar</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {pendingToLeave} registro(s) da coleta ainda estão só neste aparelho. Conecte-se à internet e espere aparecer “Salvo” antes de
            sair. Se sair agora, eles continuam guardados aqui e são enviados quando você entrar de novo neste aparelho.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ficar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void signOut()}>Sair mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

/**
 * Layout base: menu lateral no computador, barra inferior no celular.
 */
export function AppLayout() {
  const { profile } = useAuth()
  const clinic = useClinic()
  const items = profile ? navFor(profile.role) : []
  useOfflinePrefetch()

  return (
    <div className="min-h-dvh md:flex">
      {/* Menu lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-5 py-6">
          <Logo />
          {clinic.data && <p className="mt-2 truncate text-sm text-muted-foreground">{clinic.data.name}</p>}
        </div>
        <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <SyncIndicator compact className="mb-2" />
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo (celular) */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/95 px-4 py-2 backdrop-blur md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <SyncIndicator compact />
            <UserMenu compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-10">
          <OpenSessionBanner />
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground',
                    isActive && 'text-primary',
                  )
                }
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

import { KeyRound, MoreVertical, Pencil, Search, UserCheck, UserPlus, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/PersonAvatar'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ROLE_LABEL, useAuth } from '@/features/auth/AuthProvider'
import { formatDate } from '@/lib/dates'

import { useAdminAction, useTeam, type TeamMember } from './api'
import { MemberDialog, ResetPasswordDialog } from './MemberDialogs'

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function TeamSection() {
  const { profile } = useAuth()
  const team = useTeam()
  const action = useAdminAction()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<TeamMember | null>(null)
  const [toggling, setToggling] = useState<TeamMember | null>(null)

  const members = useMemo(() => {
    const q = normalize(search.trim())
    return (team.data ?? []).filter(
      (m) => (showInactive || m.active) && (!q || normalize(m.full_name).includes(q) || m.email.includes(q)),
    )
  }, [team.data, search, showInactive])
  const inactiveCount = (team.data ?? []).filter((m) => !m.active).length

  async function confirmToggle() {
    if (!toggling) return
    try {
      await action.mutateAsync({ action: 'set_active', user_id: toggling.id, active: !toggling.active })
      toast.success(toggling.active ? `${toggling.full_name} foi desativado(a).` : `${toggling.full_name} foi reativado(a).`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setToggling(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-10" aria-label="Buscar membro" />
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus aria-hidden /> Adicionar membro
        </Button>
      </div>

      {inactiveCount > 0 && (
        <button type="button" className="self-start text-base text-primary underline-offset-4 hover:underline" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? 'Esconder desativados' : `Mostrar desativados (${inactiveCount})`}
        </button>
      )}

      {team.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : team.isError ? (
        <Card>
          <CardContent className="text-base text-muted-foreground">Não foi possível carregar a equipe. Verifique sua conexão.</CardContent>
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-base text-muted-foreground">Nenhum membro encontrado.</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((m) => {
            const isSelf = m.id === profile?.id
            return (
              <li key={m.id}>
                <Card className={m.active ? '' : 'opacity-70'}>
                  <CardContent className="flex items-center gap-3 py-1">
                    <PersonAvatar name={m.full_name} photoPath={m.photo_path} bucket="profile-photos" className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">
                        {m.full_name} {isSelf && <span className="font-normal text-muted-foreground">(você)</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={m.role === 'coordenador' ? 'default' : 'secondary'}>{ROLE_LABEL[m.role]}</Badge>
                        {!m.active && <Badge variant="outline">Desativado</Badge>}
                        {m.active && m.must_change_password && <Badge variant="outline">Aguardando primeiro acesso</Badge>}
                      </div>
                    </div>
                    <p className="hidden text-sm text-muted-foreground md:block">Desde {formatDate(m.created_at)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Ações para ${m.full_name}`}>
                          <MoreVertical aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setEditing(m)}>
                          <Pencil aria-hidden /> Editar
                        </DropdownMenuItem>
                        {!isSelf && (
                          <>
                            <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setResetting(m)} disabled={!m.active}>
                              <KeyRound aria-hidden /> Redefinir senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-base md:text-sm" onSelect={() => setToggling(m)}>
                              {m.active ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                              {m.active ? 'Desativar acesso' : 'Reativar acesso'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <MemberDialog open={creating} onOpenChange={setCreating} />
      <MemberDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} member={editing} isSelf={editing?.id === profile?.id} />
      <ResetPasswordDialog open={Boolean(resetting)} onOpenChange={(o) => !o && setResetting(null)} member={resetting} />

      <AlertDialog open={Boolean(toggling)} onOpenChange={(o) => !o && setToggling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggling?.active ? 'Desativar acesso?' : 'Reativar acesso?'}</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {toggling?.active
                ? `${toggling?.full_name} perde o acesso ao LovABA na hora. As sessões que essa pessoa já registrou continuam guardadas.`
                : `${toggling?.full_name} volta a entrar no LovABA com a senha que já tinha.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmToggle()} disabled={action.isPending}>
              {toggling?.active ? 'Desativar' : 'Reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

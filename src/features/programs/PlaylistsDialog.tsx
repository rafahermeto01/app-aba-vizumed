import { ListMusic, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/features/auth/AuthCard'
import { friendlyError } from '@/lib/errors'

import { useDeletePlaylist, usePlaylists, useSavePlaylist, type Playlist, type ProgramListItem } from './api'

/** Playlists: conjunto nomeado de programas para iniciar a sessão com um toque. */
export function PlaylistsDialog({
  open,
  onOpenChange,
  learnerId,
  programs,
  canManage,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  learnerId: string
  programs: ProgramListItem[]
  canManage: boolean
}) {
  const playlists = usePlaylists(learnerId)
  const save = useSavePlaylist(learnerId)
  const del = useDeletePlaylist(learnerId)
  const [editing, setEditing] = useState<{ id?: string; name: string; program_ids: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameOf = new Map(programs.map((p) => [p.id, p.name]))
  const active = programs.filter((p) => p.status === 'ativo')

  function startEdit(p?: Playlist) {
    setError(null)
    setEditing(p ? { id: p.id, name: p.name, program_ids: p.program_ids } : { name: '', program_ids: [] })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError(null)
    if (!editing.name.trim()) return setError('Dê um nome para a playlist.')
    if (editing.program_ids.length === 0) return setError('Escolha pelo menos um programa.')
    // mantém a ordem dos programas do aprendiz
    const ordered = programs.map((p) => p.id).filter((id) => editing.program_ids.includes(id))
    try {
      await save.mutateAsync({ id: editing.id, name: editing.name.trim(), program_ids: ordered })
      toast.success('Playlist salva.')
      setEditing(null)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setEditing(null)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListMusic className="size-5" aria-hidden /> {editing ? (editing.id ? 'Editar playlist' : 'Nova playlist') : 'Playlists'}
          </DialogTitle>
          {!editing && <DialogDescription>Na hora da sessão, a terapeuta escolhe uma playlist e todos os programas dela já vêm marcados.</DialogDescription>}
        </DialogHeader>

        {editing ? (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-name">Nome</Label>
              <Input id="pl-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: PDI 2026, Manhã" />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Programas</legend>
              {active.length === 0 ? (
                <p className="text-base text-muted-foreground">Nenhum programa ativo.</p>
              ) : (
                <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-xl border">
                  {active.map((p) => {
                    const id = `pl-${p.id}`
                    const checked = editing.program_ids.includes(p.id)
                    return (
                      <li key={p.id}>
                        <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(c) =>
                              setEditing({
                                ...editing,
                                program_ids: c === true ? [...editing.program_ids, p.id] : editing.program_ids.filter((x) => x !== p.id),
                              })
                            }
                          />
                          <span className="text-base">{p.name}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </fieldset>
            <FormError message={error} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Voltar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Salvando…' : 'Salvar playlist'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            {playlists.isPending ? (
              <p className="text-base text-muted-foreground">Carregando…</p>
            ) : (playlists.data ?? []).length === 0 ? (
              <p className="text-base text-muted-foreground">Nenhuma playlist ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {(playlists.data ?? []).map((p) => (
                  <li key={p.id} className="flex items-start gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.program_ids
                          .map((id) => nameOf.get(id))
                          .filter(Boolean)
                          .join(' · ') || 'Sem programas'}
                      </p>
                    </div>
                    {canManage && (
                      <>
                        <Button size="icon" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => startEdit(p)}>
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover ${p.name}`}
                          onClick={() =>
                            del.mutate(p.id, {
                              onSuccess: () => toast.success('Playlist removida.'),
                              onError: (err) => toast.error(friendlyError(err)),
                            })
                          }
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
              <Button variant="outline" className="self-start" onClick={() => startEdit()}>
                <Plus aria-hidden /> Nova playlist
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

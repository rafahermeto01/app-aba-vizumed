import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/auth/AuthCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

import { useCategories, type Category } from './api'

/** Criar, renomear e remover as pastas da biblioteca. */
export function CategoriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const categories = useCategories()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['program-categories'] })

  const create = useMutation({
    mutationFn: async () => {
      const { error: err } = await supabase
        .from('program_categories')
        .insert({ clinic_id: profile!.clinic_id, name: name.trim(), sort_order: (categories.data?.length ?? 0) + 1 })
      if (err) throw err
    },
    onSuccess: async () => {
      setName('')
      await refresh()
    },
    onError: (e) => setError(friendlyError(e)),
  })

  const rename = useMutation({
    mutationFn: async (c: { id: string; name: string }) => {
      const { error: err } = await supabase.from('program_categories').update({ name: c.name.trim() }).eq('id', c.id)
      if (err) throw err
    },
    onSuccess: async () => {
      setEditing(null)
      await refresh()
    },
    onError: (e) => setError(friendlyError(e)),
  })

  const remove = useMutation({
    mutationFn: async (c: Category) => {
      const { error: err } = await supabase.from('program_categories').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)
      if (err) throw err
    },
    onSuccess: async () => {
      toast.success('Pasta removida. Os modelos dela ficam em "Sem pasta".')
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['templates'] })])
    },
    onError: (e) => setError(friendlyError(e)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return
    if ((categories.data ?? []).some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return setError('Já existe uma pasta com esse nome.')
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pastas da biblioteca</DialogTitle>
          <DialogDescription>Organize os modelos por área (ex.: Linguagem, Imitação, Vida diária).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da nova pasta" aria-label="Nome da nova pasta" />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus aria-hidden /> Criar
          </Button>
        </form>
        <FormError message={error} />
        <ul className="flex max-h-80 flex-col divide-y overflow-y-auto">
          {(categories.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              {editing?.id === c.id ? (
                <>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Novo nome da pasta" autoFocus />
                  <Button size="icon" variant="ghost" aria-label="Salvar nome" onClick={() => editing.name.trim() && rename.mutate(editing)}>
                    <Check aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditing(null)}>
                    <X aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-base">{c.name}</span>
                  <Button size="icon" variant="ghost" aria-label={`Renomear ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Remover ${c.name}`} onClick={() => remove.mutate(c)}>
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
          {categories.data?.length === 0 && <li className="py-3 text-base text-muted-foreground">Nenhuma pasta ainda.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

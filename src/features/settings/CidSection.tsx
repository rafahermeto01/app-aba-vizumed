import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/features/auth/AuthCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCidCodes, type CidCode } from '@/features/learners/api'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function CidSection() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const codes = useCidCodes()
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [removing, setRemoving] = useState<CidCode | null>(null)

  const add = useMutation({
    mutationFn: async () => {
      const { error: err } = await supabase
        .from('cid_codes')
        .insert({ clinic_id: profile!.clinic_id, code: code.trim().toUpperCase(), description: description.trim() })
      if (err) throw err
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cid-codes'] })
      toast.success('CID adicionado.')
      setCode('')
      setDescription('')
    },
    onError: (err) => setError(friendlyError(err)),
  })

  const remove = useMutation({
    mutationFn: async (cid: CidCode) => {
      // Exclusão lógica: aprendizes que já usam o código continuam com ele no histórico.
      const { error: err } = await supabase.from('cid_codes').update({ deleted_at: new Date().toISOString() }).eq('id', cid.id)
      if (err) throw err
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cid-codes'] })
      toast.success('CID removido da lista.')
    },
    onError: (err) => toast.error(friendlyError(err)),
    onSettled: () => setRemoving(null),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim() || !description.trim()) return setError('Preencha o código e a descrição.')
    if (code.trim().length > 12) return setError('Código muito longo.')
    if ((codes.data ?? []).some((c) => c.code.toUpperCase() === code.trim().toUpperCase()))
      return setError('Este código já está na lista.')
    add.mutate()
  }

  const own = (codes.data ?? []).filter((c) => c.clinic_id)
  const reference = useMemo(() => {
    const q = norm(search.trim())
    return (codes.data ?? []).filter((c) => !c.clinic_id && (!q || norm(`${c.code} ${c.description}`).includes(q)))
  }, [codes.data, search])

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar CID</CardTitle>
          <CardDescription className="text-base">Os códigos mais usados já vêm prontos. Adicione aqui outros que a clínica precisar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-4 md:grid-cols-[10rem_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cid-code">Código</Label>
                <Input id="cid-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: F84.8" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cid-desc">Descrição</Label>
                <Input id="cid-desc" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
              </div>
            </div>
            <FormError message={error} />
            <Button type="submit" className="self-start" disabled={add.isPending}>
              <Plus aria-hidden /> {add.isPending ? 'Adicionando…' : 'Adicionar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Códigos da clínica</CardTitle>
        </CardHeader>
        <CardContent>
          {own.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhum código próprio ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {own.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="w-20 shrink-0 font-medium">{c.code}</span>
                  <span className="flex-1 text-base">{c.description}</span>
                  <Button variant="ghost" size="icon" aria-label={`Remover ${c.code}`} onClick={() => setRemoving(c)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Códigos de referência <Badge variant="secondary">{(codes.data ?? []).filter((c) => !c.clinic_id).length}</Badge>
          </CardTitle>
          <CardDescription className="text-base">Lista padrão do LovABA, igual para todas as clínicas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar código ou descrição" className="pl-10" aria-label="Buscar CID de referência" />
          </div>
          <ul className="flex max-h-96 flex-col divide-y overflow-y-auto rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" tabIndex={0} aria-label="Lista de CIDs de referência">
            {reference.map((c) => (
              <li key={c.id} className="flex gap-3 py-2">
                <span className="w-20 shrink-0 font-medium">{c.code}</span>
                <span className="text-base text-muted-foreground">{c.description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removing?.code}?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              O código sai da lista de escolha. Aprendizes que já têm este CID continuam com ele no cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove.mutate(removing)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

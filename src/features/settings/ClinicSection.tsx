import { useQueryClient } from '@tanstack/react-query'
import { ImageUp, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FormError } from '@/features/auth/AuthCard'
import { friendlyError } from '@/lib/errors'
import { ACCEPTED_IMAGES, removeFile, uploadPhoto, useSignedUrl } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

import { useClinic, type Clinic } from './useClinic'

function ClinicLogo({ path, preview }: { path: string | null; preview: string | null }) {
  const url = useSignedUrl('clinic-logos', preview ? null : path)
  const src = preview ?? url.data
  return (
    <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card">
      {src ? <img src={src} alt="Logo da clínica" className="size-full object-contain p-2" /> : <span className="px-2 text-center text-sm text-muted-foreground">Sem logo</span>}
    </div>
  )
}

function ClinicForm({ clinic }: { clinic: Clinic }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(clinic.name)
  const [initialsOnly, setInitialsOnly] = useState(clinic.show_initials_only)
  const [logo, setLogo] = useState<File | 'remove' | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!(logo instanceof File)) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(logo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logo])

  const dirty = name.trim() !== clinic.name || initialsOnly !== clinic.show_initials_only || logo !== null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Informe o nome da clínica.')
    setError(null)
    setSaving(true)
    try {
      let logoPath = clinic.logo_path
      if (logo instanceof File) logoPath = await uploadPhoto('clinic-logos', clinic.id, 'logo', logo, { keepTransparency: true, maxSize: 512 })
      if (logo === 'remove') logoPath = null
      const { error: upErr } = await supabase
        .from('clinics')
        .update({ name: name.trim(), show_initials_only: initialsOnly, logo_path: logoPath })
        .eq('id', clinic.id)
      if (upErr) throw upErr
      if (logo !== null) await removeFile('clinic-logos', clinic.logo_path)
      setLogo(null)
      await queryClient.invalidateQueries({ queryKey: ['clinic'] })
      toast.success('Dados da clínica salvos.')
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('A imagem') ? err.message : friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const hasLogo = logo instanceof File || (logo === null && Boolean(clinic.logo_path))

  return (
    <form onSubmit={(e) => void save(e)} className="flex max-w-3xl flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da clínica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="c-name">Nome da clínica</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-none font-medium">Logo</span>
            <div className="flex items-center gap-4">
              <ClinicLogo path={logo === 'remove' ? null : clinic.logo_path} preview={preview} />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_IMAGES}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setLogo(f)
                    e.target.value = ''
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={saving}>
                  <ImageUp aria-hidden /> {hasLogo ? 'Trocar logo' : 'Enviar logo'}
                </Button>
                {hasLogo && (
                  <Button type="button" variant="ghost" onClick={() => setLogo(clinic.logo_path ? 'remove' : null)} disabled={saving}>
                    <Trash2 aria-hidden /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Privacidade</CardTitle>
          <CardDescription className="text-base">Útil quando outras pessoas podem ver a tela (recepção, atendimento em grupo).</CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="c-initials" className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4">
            <span>
              <span className="block text-base font-medium">Exibir só as iniciais nas listas</span>
              <span className="block text-sm text-muted-foreground">
                Na lista de aprendizes aparecem só as iniciais (ex.: “PES”), sem foto. O nome completo continua na página de cada aprendiz.
              </span>
            </span>
            <Switch id="c-initials" checked={initialsOnly} onCheckedChange={setInitialsOnly} />
          </label>
        </CardContent>
      </Card>

      <FormError message={error} />
      <Button type="submit" size="lg" className="self-start" disabled={saving || !dirty}>
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

export function ClinicSection() {
  const clinic = useClinic()
  if (clinic.isPending) return <p className="text-base text-muted-foreground">Carregando…</p>
  if (!clinic.data) return <p className="text-base text-muted-foreground">Não foi possível carregar os dados da clínica.</p>
  return <ClinicForm key={clinic.data.id + clinic.data.name + clinic.data.logo_path} clinic={clinic.data} />
}

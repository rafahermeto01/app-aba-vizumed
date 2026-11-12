import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { PhotoPicker, type PhotoChoice } from '@/components/PhotoPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/features/auth/AuthCard'
import { ROLE_LABEL, useAuth } from '@/features/auth/AuthProvider'
import { NewPasswordForm } from '@/features/auth/NewPasswordForm'
import { friendlyError } from '@/lib/errors'
import { removeFile, uploadPhoto } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [photo, setPhoto] = useState<PhotoChoice>({ kind: 'keep' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordKey, setPasswordKey] = useState(0)

  if (!profile) return null

  const dirty = fullName.trim() !== profile.full_name || photo.kind !== 'keep'

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    if (!fullName.trim()) return setError('Informe o seu nome.')
    setError(null)
    setSaving(true)
    try {
      let photoPath = profile.photo_path
      if (photo.kind === 'new') photoPath = await uploadPhoto('profile-photos', profile.clinic_id, profile.id, photo.file)
      if (photo.kind === 'remove') photoPath = null
      const { error: upErr } = await supabase.from('profiles').update({ full_name: fullName.trim(), photo_path: photoPath }).eq('id', profile.id)
      if (upErr) throw upErr
      if (photo.kind !== 'keep') await removeFile('profile-photos', profile.photo_path)
      await refreshProfile()
      setPhoto({ kind: 'keep' })
      toast.success('Perfil atualizado.')
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith('A imagem') ? err.message : friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Meu perfil" />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seus dados</CardTitle>
            <CardDescription className="text-base">
              {profile.email} · {ROLE_LABEL[profile.role]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void save(e)} className="flex flex-col gap-5" noValidate>
              <PhotoPicker name={fullName} currentPath={profile.photo_path} bucket="profile-photos" value={photo} onChange={setPhoto} disabled={saving} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-name">Nome completo</Label>
                <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </div>
              <p className="text-sm text-muted-foreground">Para trocar o e-mail ou o perfil de acesso, fale com a coordenação.</p>
              <FormError message={error} />
              <Button type="submit" className="self-start" disabled={saving || !dirty}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trocar senha</CardTitle>
          </CardHeader>
          <CardContent>
            <NewPasswordForm
              key={passwordKey}
              submitLabel="Trocar senha"
              onDone={() => {
                toast.success('Senha alterada.')
                setPasswordKey((k) => k + 1)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

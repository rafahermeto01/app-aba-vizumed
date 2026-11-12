import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ROLE_LABEL } from '@/features/auth/AuthProvider'
import { useTeam } from '@/features/team/api'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Lista da equipe com busca e caixas de marcar. É este vínculo que faz o
 * aprendiz aparecer para cada profissional.
 */
export function TeamPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const team = useTeam()
  const [search, setSearch] = useState('')

  // Membros ativos + quem já estava vinculado (mesmo que desativado depois)
  const members = useMemo(() => {
    const q = norm(search.trim())
    return (team.data ?? [])
      .filter((m) => m.active || value.includes(m.id))
      .filter((m) => !q || norm(m.full_name).includes(q))
  }, [team.data, search, value])

  const toggle = (id: string, checked: boolean) => onChange(checked ? [...value, id] : value.filter((v) => v !== id))

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar profissional" className="pl-10" aria-label="Buscar profissional" />
      </div>
      <p className="text-sm text-muted-foreground">
        {value.length === 0 ? 'Ninguém vinculado ainda.' : value.length === 1 ? '1 profissional vinculado.' : `${value.length} profissionais vinculados.`}{' '}
        A coordenação vê todos os aprendizes, mesmo sem vínculo.
      </p>
      {team.isPending ? (
        <p className="text-base text-muted-foreground">Carregando equipe…</p>
      ) : members.length === 0 ? (
        <p className="text-base text-muted-foreground">Nenhum profissional encontrado.</p>
      ) : (
        <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-xl border">
          {members.map((m) => {
            const checked = value.includes(m.id)
            const inputId = `team-${m.id}`
            return (
              <li key={m.id}>
                <label htmlFor={inputId} className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <Checkbox id={inputId} checked={checked} onCheckedChange={(c) => toggle(m.id, c === true)} />
                  <PersonAvatar name={m.full_name} photoPath={m.photo_path} bucket="profile-photos" className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base">{m.full_name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {ROLE_LABEL[m.role]}
                      {!m.active && ' · desativado'}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { maskPhone } from '@/lib/phone'

export type GuardianDraft = { key: string; id?: string; name: string; relationship: string; phone: string; email: string }

export const emptyGuardian = (): GuardianDraft => ({ key: crypto.randomUUID(), name: '', relationship: '', phone: '', email: '' })

const RELATIONSHIPS = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Irmã', 'Irmão', 'Responsável legal']

/** Vários responsáveis: nome, parentesco, telefone e e-mail. */
export function GuardiansField({
  value,
  onChange,
  errors,
}: {
  value: GuardianDraft[]
  onChange: (next: GuardianDraft[]) => void
  errors?: Record<string, string>
}) {
  const update = (key: string, patch: Partial<GuardianDraft>) => onChange(value.map((g) => (g.key === key ? { ...g, ...patch } : g)))

  return (
    <div className="flex flex-col gap-4">
      <datalist id="relationship-options">
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {value.length === 0 && <p className="text-base text-muted-foreground">Nenhum responsável cadastrado.</p>}

      {value.map((g, i) => (
        <fieldset key={g.key} className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <legend className="text-base font-medium">Responsável {i + 1}</legend>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((x) => x.key !== g.key))}>
              <Trash2 aria-hidden /> Remover
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`g-name-${g.key}`}>Nome</Label>
              <Input
                id={`g-name-${g.key}`}
                value={g.name}
                onChange={(e) => update(g.key, { name: e.target.value })}
                aria-invalid={Boolean(errors?.[g.key]) || undefined}
                autoComplete="off"
              />
              {errors?.[g.key] && <p className="text-sm text-destructive">{errors[g.key]}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`g-rel-${g.key}`}>Parentesco</Label>
              <Input id={`g-rel-${g.key}`} list="relationship-options" value={g.relationship} onChange={(e) => update(g.key, { relationship: e.target.value })} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`g-phone-${g.key}`}>Telefone</Label>
              <Input
                id={`g-phone-${g.key}`}
                type="tel"
                inputMode="tel"
                placeholder="(11) 98888-7777"
                value={g.phone}
                onChange={(e) => update(g.key, { phone: maskPhone(e.target.value) })}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`g-email-${g.key}`}>E-mail</Label>
              <Input id={`g-email-${g.key}`} type="email" inputMode="email" value={g.email} onChange={(e) => update(g.key, { email: e.target.value })} autoComplete="off" />
            </div>
          </div>
        </fieldset>
      ))}

      <Button type="button" variant="outline" className="self-start" onClick={() => onChange([...value, emptyGuardian()])}>
        <Plus aria-hidden /> Adicionar responsável
      </Button>
    </div>
  )
}

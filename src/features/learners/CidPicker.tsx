import { Check, ChevronsUpDown, X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { useCidCodes } from './api'

/** Escolha de vários CIDs, com busca por código ou descrição. */
export function CidPicker({ value, onChange, id }: { value: string[]; onChange: (ids: string[]) => void; id?: string }) {
  const [open, setOpen] = useState(false)
  const codes = useCidCodes()
  const byId = new Map((codes.data ?? []).map((c) => [c.id, c]))
  const selected = value.map((v) => byId.get(v)).filter((c): c is NonNullable<typeof c> => Boolean(c))

  const toggle = (cid: string) => onChange(value.includes(cid) ? value.filter((v) => v !== cid) : [...value, cid])

  return (
    <div className="flex flex-col gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Buscar CID por código ou nome" className="w-full justify-between font-normal">
            <span className="truncate text-muted-foreground">{codes.isPending ? 'Carregando CIDs…' : 'Buscar CID por código ou nome'}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              const s = search.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
              const v = itemValue.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
              return v.includes(s) ? 1 : 0
            }}
          >
            <CommandInput placeholder="Ex.: F84 ou autismo" className="text-base" />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum CID encontrado. A coordenação pode cadastrar novos em Configurações → CIDs.</CommandEmpty>
              <CommandGroup>
                {(codes.data ?? []).map((c) => (
                  <CommandItem key={c.id} value={`${c.code} ${c.description}`} onSelect={() => toggle(c.id)}>
                    <Check className={cn('size-4', value.includes(c.id) ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    <span className="font-medium">{c.code}</span>
                    <span className="truncate text-muted-foreground">{c.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="CIDs escolhidos">
          {selected.map((c) => (
            <li key={c.id}>
              <Badge variant="secondary" className="h-auto max-w-full gap-1.5 py-1 pr-1 pl-2.5 whitespace-normal">
                <span>
                  <strong>{c.code}</strong> {c.description}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-background/70"
                  aria-label={`Remover ${c.code}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

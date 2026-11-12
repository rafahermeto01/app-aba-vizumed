import { Camera, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import { ACCEPTED_IMAGES, type Bucket } from '@/lib/storage'
import { cn } from '@/lib/utils'

/** O que a pessoa escolheu: manter a foto atual, uma foto nova, ou remover. */
export type PhotoChoice = { kind: 'keep' } | { kind: 'new'; file: File } | { kind: 'remove' }

/**
 * Foto opcional com pré-visualização. Não envia nada sozinho: quem usa decide
 * quando salvar (`onChange` devolve a escolha).
 */
export function PhotoPicker({
  name,
  currentPath,
  bucket,
  value,
  onChange,
  disabled,
  className,
}: {
  name: string
  currentPath: string | null | undefined
  bucket: Bucket
  value: PhotoChoice
  onChange: (choice: PhotoChoice) => void
  disabled?: boolean
  className?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (value.kind !== 'new') {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const hasPhoto = value.kind === 'new' || (value.kind === 'keep' && Boolean(currentPath))

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {preview ? (
        <img src={preview} alt="" className="size-20 rounded-full object-cover" />
      ) : (
        <PersonAvatar name={name || '?'} photoPath={value.kind === 'remove' ? null : currentPath} bucket={bucket} className="size-20 text-xl" />
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGES}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange({ kind: 'new', file })
            e.target.value = ''
          }}
        />
        <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Camera aria-hidden /> {hasPhoto ? 'Trocar foto' : 'Adicionar foto'}
        </Button>
        {hasPhoto && (
          <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(currentPath ? { kind: 'remove' } : { kind: 'keep' })}>
            <Trash2 aria-hidden /> Remover
          </Button>
        )}
      </div>
    </div>
  )
}

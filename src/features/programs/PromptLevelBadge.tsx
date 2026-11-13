import { cn } from '@/lib/utils'

import { readableTextColor } from './constants'
import type { PromptLevel } from './usePromptLevels'

/** Etiqueta colorida do nível de ajuda (ex.: "AFP"). */
export function PromptLevelBadge({
  level,
  className,
  showName = false,
}: {
  level: Pick<PromptLevel, 'abbreviation' | 'color' | 'name'> | null | undefined
  className?: string
  showName?: boolean
}) {
  if (!level) return <span className={cn('text-sm text-muted-foreground', className)}>Sem nível</span>
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm font-semibold', className)}
      style={{ backgroundColor: level.color, color: readableTextColor(level.color) }}
      title={level.name}
    >
      {level.abbreviation}
      {showName && <span className="font-normal opacity-90">· {level.name}</span>}
    </span>
  )
}

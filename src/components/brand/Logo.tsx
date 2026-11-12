import { HeartHandshake } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Logotipo em texto. Para trocar, edite só este arquivo. */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight text-foreground', className)}>
      <span
        className={cn(
          'grid place-items-center rounded-xl bg-primary text-primary-foreground',
          size === 'lg' ? 'size-11' : 'size-8',
        )}
      >
        <HeartHandshake className={size === 'lg' ? 'size-6' : 'size-[18px]'} aria-hidden />
      </span>
      <span className={size === 'lg' ? 'text-3xl' : 'text-xl'}>
        Lov<span className="text-primary">ABA</span>
      </span>
    </span>
  )
}

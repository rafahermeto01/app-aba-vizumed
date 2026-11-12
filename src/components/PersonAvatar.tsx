import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarInitials } from '@/lib/initials'
import { useSignedUrl, type Bucket } from '@/lib/storage'
import { cn } from '@/lib/utils'

/**
 * Foto (pasta privada) ou iniciais. `initials` permite mostrar as iniciais
 * cadastradas do aprendiz em vez de calcular pelo nome.
 */
export function PersonAvatar({
  name,
  initials,
  photoPath,
  bucket,
  className,
  hidePhoto = false,
}: {
  name: string
  initials?: string
  photoPath?: string | null
  bucket: Bucket
  className?: string
  hidePhoto?: boolean
}) {
  const url = useSignedUrl(bucket, hidePhoto ? null : photoPath)
  const letters = (initials && initials.length <= 3 ? initials : avatarInitials(initials || name)) || '?'
  return (
    <Avatar className={cn('size-10', className)}>
      {url.data && <AvatarImage src={url.data} alt="" className="object-cover" />}
      <AvatarFallback className="bg-secondary font-medium text-secondary-foreground">{letters}</AvatarFallback>
    </Avatar>
  )
}

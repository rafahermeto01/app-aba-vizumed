import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type Bucket = 'clinic-logos' | 'profile-photos' | 'learner-photos' | 'signatures'

const SIGNED_URL_SECONDS = 60 * 60 // 1 hora

/**
 * Endereço temporário (URL assinada) de um arquivo privado.
 * As pastas são privadas: sem login e sem permissão, o arquivo não abre.
 */
export function useSignedUrl(bucket: Bucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: Boolean(path),
    staleTime: (SIGNED_URL_SECONDS - 300) * 1000,
    gcTime: SIGNED_URL_SECONDS * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, SIGNED_URL_SECONDS)
      if (error) throw error
      return data.signedUrl
    },
  })
}

/** Reduz a foto no próprio aparelho (mais rápido de enviar pelo celular). */
export async function resizeImage(file: File, maxSize = 640, quality = 0.85, mime: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff' // JPEG não tem transparência: fundo branco
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))
  if (!blob) throw new Error('falha ao converter a imagem')
  return blob
}

export const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp'
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // antes de reduzir

/**
 * Envia uma foto já reduzida para `{pasta}/{clinica}/{dono}/{arquivo-novo}.jpg`.
 * Usa um nome novo a cada envio (evita a foto antiga ficar presa no cache).
 */
export async function uploadPhoto(
  bucket: Bucket,
  clinicId: string,
  ownerId: string,
  file: File,
  { keepTransparency = false, maxSize = 640 }: { keepTransparency?: boolean; maxSize?: number } = {},
): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('A imagem é muito grande (máximo 15 MB).')
  const mime = keepTransparency ? 'image/png' : 'image/jpeg'
  const blob = await resizeImage(file, maxSize, 0.85, mime)
  const path = `${clinicId}/${ownerId}/${crypto.randomUUID()}.${keepTransparency ? 'png' : 'jpg'}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: mime, upsert: false })
  if (error) throw error
  return path
}

/** Remove a foto antiga (se houver). Falhas aqui não atrapalham o usuário. */
export async function removeFile(bucket: Bucket, path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(bucket).remove([path]).catch(() => undefined)
}

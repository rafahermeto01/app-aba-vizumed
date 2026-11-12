const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du'])

/** "Ana Beatriz de Souza" → "ABS" (mesma regra do banco). */
export function makeInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !CONNECTORS.has(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** Para avatares: no máximo 2 letras (primeira e última). */
export function avatarInitials(name: string): string {
  const all = makeInitials(name)
  return all.length <= 2 ? all : all[0] + all[all.length - 1]
}

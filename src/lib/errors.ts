/**
 * Traduz erros do Supabase/rede para mensagens simples em português.
 * Nunca mostrar mensagem técnica para a equipe da clínica.
 */
type MaybePgError = { code?: string; message?: string; details?: string }

export function friendlyError(error: unknown, fallback = 'Não foi possível salvar agora. Tente de novo em instantes.'): string {
  if (!error) return fallback
  const e = error as MaybePgError
  const msg = (e.message ?? String(error)).toLowerCase()

  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed'))
    return 'Sem conexão com a internet. Verifique e tente de novo.'
  if (e.code === '23505') {
    if (msg.includes('cpf')) return 'Já existe um aprendiz com este CPF.'
    if (msg.includes('cid')) return 'Este código CID já existe.'
    return 'Este registro já existe.'
  }
  if (e.code === '23514' && msg.includes('cpf')) return 'CPF inválido.'
  if (e.code === '42501' || msg.includes('row-level security') || msg.includes('permission denied'))
    return 'Você não tem permissão para fazer isso.'
  if (e.code === 'P0001' || e.code === '23514' || e.code === 'P0002') {
    // Mensagens escritas por nós no banco (já em português)
    return e.message ?? fallback
  }
  if (msg.includes('jwt') || msg.includes('session')) return 'Sua sessão expirou. Entre de novo.'
  return fallback
}

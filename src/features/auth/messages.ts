/** Traduz erros do login para mensagens simples (nunca mostrar erro técnico). */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('email not confirmed')) return 'Este e-mail ainda não foi confirmado.'
  if (msg.includes('banned') || msg.includes('user is banned')) return 'Seu acesso foi desativado. Fale com a coordenação.'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (msg.includes('should be different') || msg.includes('same password')) return 'A nova senha precisa ser diferente da atual.'
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('at least') || msg.includes('characters')))
    return 'Senha fraca. Use pelo menos 8 caracteres.'
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sem conexão com a internet. Tente de novo.'
  return 'Não foi possível concluir agora. Tente de novo em instantes.'
}

export const MIN_PASSWORD = 8

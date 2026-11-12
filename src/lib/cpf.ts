/** Mantém só os dígitos. */
export function cpfDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

/** Máscara 000.000.000-00 enquanto a pessoa digita. */
export function maskCpf(value: string): string {
  const d = cpfDigits(value)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** Valida os dígitos verificadores (mesma regra do banco). */
export function isValidCpf(value: string): boolean {
  const d = cpfDigits(value)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const n = d.split('').map(Number)
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === n[9] && digit(10) === n[10]
}

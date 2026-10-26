export const APC_EMAIL_DOMAINS = ['apc.edu.ph', 'student.apc.edu.ph'] as const

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isApcEmail(email: string): boolean {
  const normalized = normalizeEmail(email)
  const at = normalized.indexOf('@')
  if (at <= 0 || at !== normalized.lastIndexOf('@')) return false
  const domain = normalized.slice(at + 1)
  return (APC_EMAIL_DOMAINS as readonly string[]).includes(domain)
}

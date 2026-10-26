import { api } from '@/lib/api'

export type OrgInvite = {
  orgId: string
  orgName: string
  logoUrl: string | null
  invitedByName: string | null
  invitedAt: string | null
}

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

const RELATIVE_UNITS: { limit: number; unit: Intl.RelativeTimeFormatUnit; size: number }[] = [
  { limit: 60, unit: 'second', size: 1 },
  { limit: 3600, unit: 'minute', size: 60 },
  { limit: 86400, unit: 'hour', size: 3600 },
  { limit: 86400 * 30, unit: 'day', size: 86400 },
  { limit: 86400 * 365, unit: 'month', size: 86400 * 30 },
  { limit: Number.POSITIVE_INFINITY, unit: 'year', size: 86400 * 365 },
]

function parseInviteInstant(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return Number.NaN
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const zoned = HAS_ZONE.test(trimmed) ? normalized : `${normalized}Z`
  return Date.parse(zoned)
}

export function formatRelativeTime(value: string, now = Date.now()): string {
  const then = parseInviteInstant(value)
  if (Number.isNaN(then)) return ''
  const deltaSeconds = Math.round((then - now) / 1000)
  const elapsed = Math.abs(deltaSeconds)
  const bucket = RELATIVE_UNITS.find((unit) => elapsed < unit.limit) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1]
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round(deltaSeconds / bucket.size),
    bucket.unit,
  )
}

export function formatInviteMeta(invite: Pick<OrgInvite, 'invitedByName' | 'invitedAt'>, now = Date.now()): string {
  const name = invite.invitedByName?.trim() || 'someone'
  const when = invite.invitedAt ? formatRelativeTime(invite.invitedAt, now) : ''
  return when ? `Invited by ${name} · ${when}` : `Invited by ${name}`
}

export async function loadPendingInvites(): Promise<OrgInvite[]> {
  const data = await api.get<unknown>('/api/orgs/invites')
  if (!Array.isArray(data)) return []
  const invites: OrgInvite[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    if (typeof record.orgId !== 'string' || typeof record.orgName !== 'string') continue
    invites.push({
      orgId: record.orgId,
      orgName: record.orgName,
      logoUrl: typeof record.logoUrl === 'string' ? record.logoUrl : null,
      invitedByName: typeof record.invitedByName === 'string' ? record.invitedByName : null,
      invitedAt: typeof record.invitedAt === 'string' ? record.invitedAt : null,
    })
  }
  return invites
}

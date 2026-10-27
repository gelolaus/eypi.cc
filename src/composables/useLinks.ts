import { ref, type InjectionKey } from 'vue'
import { ApiError, api } from '@/lib/api'
import { fetchQuery, invalidate, peekQuery } from '@/lib/queryCache'
import type { LinkQrConfig } from '@shared/linkQrConfig'

export type LinkSort = 'new' | 'old' | 'clicks'
export type LinkStatusFilter = 'all' | 'active' | 'expired' | 'disabled' | 'protected'

export type LinkListItem = {
  id: string
  slug: string
  url: string
  clicks: number
  createdAt: string | null
  expiresAt: string | null
  disabledAt: string | null
  disabledReason: string | null
  protected: boolean
  hasLogo: boolean
}

export type LinkDetail = LinkListItem & {
  qrConfig: LinkQrConfig | null
}

export type LinkWrite = {
  url?: string
  slug?: string
  expiresAt?: string | null
  password?: string | null
  qrConfig?: LinkQrConfig | null
  disabled?: boolean
}

export type LinkBadgeInput = {
  expiresAt: string | null
  disabledAt: string | null
  disabledReason: string | null
  protected: boolean
}

const QUOTA_MESSAGE = "You've reached 500 links. Delete some to add more."

export function linkBadges(link: LinkBadgeInput, now = Date.now()): string[] {
  const badges: string[] = []
  if (link.expiresAt) {
    const expires = Date.parse(link.expiresAt)
    if (Number.isFinite(expires) && expires <= now) badges.push('Expired')
  }
  if (link.disabledAt) {
    const moderator = link.disabledReason === 'admin' || link.disabledReason === 'abuse'
    badges.push(moderator ? 'Disabled by moderator' : 'Disabled')
  }
  if (link.protected) badges.push('Protected')
  return badges
}

type Page = {
  items?: LinkListItem[]
  nextCursor?: string | null
}

export function useLinks() {
  const items = ref<LinkListItem[]>([])
  const nextCursor = ref<string | null>(null)
  const loading = ref(false)
  const error = ref('')
  const quotaMessage = ref('')
  const query = ref('')
  const sort = ref<LinkSort>('new')
  const status = ref<LinkStatusFilter>('all')

  function listPath(cursor?: string | null): string {
    const params = new URLSearchParams()
    const q = query.value.trim()
    if (q) params.set('q', q)
    if (sort.value !== 'new') params.set('sort', sort.value)
    if (status.value !== 'all') params.set('status', status.value)
    if (cursor) params.set('cursor', cursor)
    const qs = params.toString()
    return qs ? `/api/links?${qs}` : '/api/links'
  }

  function replace(detail: LinkListItem) {
    const index = items.value.findIndex((item) => item.id === detail.id)
    if (index === -1) {
      items.value = [detail, ...items.value]
      return
    }
    const next = items.value.slice()
    next[index] = detail
    items.value = next
  }

  let listGeneration = 0

  async function load(cursor?: string | null) {
    const generation = ++listGeneration
    const path = listPath(cursor)
    const key = `links:list:${path}`
    const cached = cursor ? undefined : peekQuery<Page>(key)
    if (cached) {
      items.value = cached.items ?? []
      nextCursor.value = cached.nextCursor ?? null
    }
    loading.value = !cached
    error.value = ''
    try {
      const data = await fetchQuery(key, () => api.get<Page>(path))
      if (generation !== listGeneration) return
      const page = data.items ?? []
      items.value = cursor ? [...items.value, ...page] : page
      nextCursor.value = data.nextCursor ?? null
    } catch (err) {
      if (generation !== listGeneration) return
      if (err instanceof ApiError && err.status === 401) return
      error.value = err instanceof Error ? err.message : 'Could not load links.'
    } finally {
      if (generation === listGeneration) loading.value = false
    }
  }

  async function loadMore() {
    if (!nextCursor.value || loading.value) return
    await load(nextCursor.value)
  }

  async function create(body: LinkWrite): Promise<LinkDetail> {
    try {
      const created = await api.post<LinkDetail>('/api/links', body)
      quotaMessage.value = ''
      invalidate('links:')
      items.value = [created, ...items.value.filter((item) => item.id !== created.id)]
      return created
    } catch (err) {
      if (err instanceof ApiError && err.code === 'quota_exceeded') {
        quotaMessage.value = QUOTA_MESSAGE
      }
      throw err
    }
  }

  async function update(id: string, body: LinkWrite): Promise<LinkDetail> {
    const updated = await api.patch<LinkDetail>(`/api/links/${id}`, body)
    invalidate('links:')
    replace(updated)
    return updated
  }

  async function remove(id: string): Promise<void> {
    await api.del(`/api/links/${id}`)
    invalidate('links:')
    items.value = items.value.filter((item) => item.id !== id)
  }

  async function bulk(action: 'delete' | 'disable' | 'enable', ids: string[]): Promise<void> {
    await api.post('/api/links/bulk', { action, ids })
    invalidate('links:')
    if (action === 'delete') {
      const drop = new Set(ids)
      items.value = items.value.filter((item) => !drop.has(item.id))
      return
    }
    await load()
  }

  return {
    items,
    nextCursor,
    loading,
    error,
    quotaMessage,
    query,
    sort,
    status,
    load,
    loadMore,
    create,
    update,
    remove,
    bulk,
  }
}

export type UseLinks = ReturnType<typeof useLinks>
export const linksKey: InjectionKey<UseLinks> = Symbol('links')

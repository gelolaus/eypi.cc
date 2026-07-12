import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { API_BASE_URL } from '@/config/api'
import type { OrgListItem } from '@/types/orgs'

/** Shared across every caller — nav, OrgSwitcher, and org pages must stay in sync. */
const orgs = ref<OrgListItem[]>([])
const activeOrg = ref<OrgListItem | null>(null)
const isLoading = ref(false)

export function useActiveOrg() {
  const toast = useToast()
  const { authHeaders } = useAuth()
  const router = useRouter()

  async function fetchOrgs() {
    isLoading.value = true
    try {
      const res = await fetch(`${API_BASE_URL}/api/orgs`, {
        headers: authHeaders(),
      })
      const data = (await res.json()) as { orgs?: OrgListItem[] }
      if (res.ok) {
        orgs.value = data.orgs ?? []
        const savedActiveOrgId = localStorage.getItem('active_org_id')
        let selected = orgs.value.find((o) => o.org_id === savedActiveOrgId)
        if (!selected && orgs.value.length > 0) {
          selected = orgs.value[0]
          localStorage.setItem('active_org_id', selected.org_id)
        }
        activeOrg.value = selected ?? null
      }
    } catch (err) {
      console.error('Error fetching orgs:', err)
    } finally {
      isLoading.value = false
    }
  }

  /** Quiet sync (no toast / navigation) — used when a URL already picked the org. */
  function setActiveOrg(org: OrgListItem) {
    localStorage.setItem('active_org_id', org.org_id)
    activeOrg.value = org
  }

  function isOnOrgModifyRoute() {
    const route = router.currentRoute.value
    return route.name === 'orgs-modify' || route.name === 'orgs-modify-index' || route.path.startsWith('/orgs/modify')
  }

  function selectOrg(org: OrgListItem) {
    const route = router.currentRoute.value
    const onModify = isOnOrgModifyRoute()
    const alreadyActive = activeOrg.value?.org_id === org.org_id
    const modifySlug = typeof route.params.slug === 'string' ? route.params.slug : null
    const modifyNeedsNav = onModify && modifySlug !== org.org_id

    if (alreadyActive && !modifyNeedsNav) return

    setActiveOrg(org)
    if (!alreadyActive) toast.success(org.org_name)

    if (onModify) {
      if (modifyNeedsNav) {
        router.push({ name: 'orgs-modify', params: { slug: org.org_id } })
      }
      return
    }

    if (!alreadyActive) globalThis.location.reload()
  }

  return { orgs, activeOrg, isLoading, fetchOrgs, selectOrg, setActiveOrg }
}

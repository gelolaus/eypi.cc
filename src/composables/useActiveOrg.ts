import { api } from '@/lib/api'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useToast } from '@/composables/useToast'
import type { OrgListItem } from '@/types/orgs'

/** Shared across every caller — nav, OrgSwitcher, and org pages must stay in sync. */
const orgs = ref<OrgListItem[]>([])
const activeOrg = ref<OrgListItem | null>(null)
const orgsLoaded = ref(false)
const isLoading = ref(false)
const ORG_HINT_KEY = 'eypi.hasOrg'

function readOrgHint() {
  try {
    return localStorage.getItem(ORG_HINT_KEY)
  } catch {
    return null
  }
}

function writeOrgHint(hasOrg: boolean) {
  try {
    localStorage.setItem(ORG_HINT_KEY, hasOrg ? '1' : '0')
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
}

export function clearOrgHint() {
  try {
    localStorage.removeItem(ORG_HINT_KEY)
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
}

const hasOrg = computed(() => orgs.value.length > 0 || (!orgsLoaded.value && readOrgHint() === '1'))

export function useActiveOrg() {
  const toast = useToast()
  const router = useRouter()

  async function fetchOrgs() {
    isLoading.value = true
    try {
      const res = await api.raw('/api/orgs')
      const data = (await res.json()) as { orgs?: OrgListItem[] }
      if (res.ok) {
        orgs.value = data.orgs ?? []
        orgsLoaded.value = true
        writeOrgHint(orgs.value.length > 0)
        let savedActiveOrgId: string | null = null
        try {
          savedActiveOrgId = localStorage.getItem('active_org_id')
        } catch {
          // Continue with the first available org when storage is unavailable.
        }
        let selected = orgs.value.find((o) => o.org_id === savedActiveOrgId)
        if (!selected && orgs.value.length > 0) {
          selected = orgs.value[0]
          try {
            localStorage.setItem('active_org_id', selected.org_id)
          } catch {
            // The in-memory selection remains usable without persisted storage.
          }
        }
        if (activeOrg.value && activeOrg.value.org_id !== selected?.org_id) {
          useOrgMembership().clearOrgMembershipCache()
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
    if (activeOrg.value && activeOrg.value.org_id !== org.org_id) useOrgMembership().clearOrgMembershipCache()
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

  return { orgs, activeOrg, orgsLoaded, hasOrg, isLoading, fetchOrgs, selectOrg, setActiveOrg }
}

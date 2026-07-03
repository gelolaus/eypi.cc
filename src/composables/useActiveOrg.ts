import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { API_BASE_URL } from '@/config/api'
import type { OrgListItem } from '@/types/orgs'

export function useActiveOrg() {
  const toast = useToast()
  const { authHeaders } = useAuth()

  const orgs = ref<OrgListItem[]>([])
  const activeOrg = ref<OrgListItem | null>(null)
  const isLoading = ref(false)

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

  function selectOrg(org: OrgListItem) {
    if (activeOrg.value?.org_id === org.org_id) return
    localStorage.setItem('active_org_id', org.org_id)
    activeOrg.value = org
    toast.success(`Active context: ${org.org_id}`)
    window.location.reload()
  }

  return { orgs, activeOrg, isLoading, fetchOrgs, selectOrg }
}

import { useRouter } from 'vue-router'
import { clearOrgHint, useActiveOrg } from '@/composables/useActiveOrg'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/stores/session'

/** Ends the session, clears the active org and returns to the login page. */
export function useSignOut() {
  const router = useRouter()
  const toast = useToast()
  const session = useSession()
  const drawer = useNavDrawer()
  const { orgs, activeOrg } = useActiveOrg()

  return async function signOut() {
    await session.logout()
    orgs.value = []
    activeOrg.value = null
    clearOrgHint()
    drawer.close()
    toast.success('Signed out.')
    await router.push('/login')
  }
}

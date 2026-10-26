<template>
  <Card class="flex-col gap-4 rounded-2xl p-5 text-left sm:flex-row sm:items-center">
    <OrgLogo
      :logo-url="invite.logoUrl"
      :name="invite.orgName"
      size="md"
    />
    <div class="min-w-0 flex-1">
      <h2 class="break-words font-heading text-lg font-semibold">
        {{ invite.orgName }}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ meta }}
      </p>
      <p
        v-if="error"
        role="alert"
        class="mt-2 text-sm text-destructive"
      >
        {{ error }}
      </p>
    </div>
    <div class="flex shrink-0 gap-2 max-sm:[&>button]:flex-1">
      <Button
        type="button"
        variant="outline"
        class="text-sm"
        :disabled="busy"
        @click="decline"
      >
        Decline
      </Button>
      <Button
        type="button"
        class="px-4 text-sm"
        :disabled="busy"
        @click="accept"
      >
        Accept
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import OrgLogo from '@/components/OrgLogo.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatInviteMeta, type OrgInvite } from '@/components/orgs/invites'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useDialog } from '@/composables/useDialog'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/lib/api'
import { api } from '@/lib/api'
import { useSession } from '@/stores/session'

const props = defineProps<{
  invite: OrgInvite
}>()

const emit = defineEmits<{
  declined: [orgId: string]
}>()

const router = useRouter()
const dialog = useDialog()
const toast = useToast()
const session = useSession()
const { fetchOrgs, orgs, setActiveOrg } = useActiveOrg()
const busy = ref(false)
const confirming = ref(false)
const error = ref('')

const meta = computed(() => formatInviteMeta(props.invite))

function invitePath(action: 'accept' | 'decline'): string {
  return `/api/orgs/invites/${encodeURIComponent(props.invite.orgId)}/${action}`
}

function rememberFailure(err: unknown, fallback: string) {
  error.value = err instanceof ApiError ? err.message : fallback
}

function noteOneLessInvite() {
  session.pendingInviteCount.value = Math.max(0, session.pendingInviteCount.value - 1)
  void session.reload()
}

async function accept() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await api.post(invitePath('accept'))
    useOrgMembership().clearOrgMembershipCache()
    await fetchOrgs()
    const match = orgs.value.find((org) => org.org_id === props.invite.orgId)
    setActiveOrg(match ?? {
      org_id: props.invite.orgId,
      org_name: props.invite.orgName,
      logo_url: props.invite.logoUrl,
      owner_id: '',
      is_owner: 0,
      created_at: '',
    })
    toast.success(`Joined ${props.invite.orgName}.`)
    noteOneLessInvite()
    await router.push(`/orgs/${props.invite.orgId}`)
  } catch (err) {
    rememberFailure(err, 'Could not accept this invite. Try again.')
  } finally {
    busy.value = false
  }
}

async function decline() {
  if (busy.value || confirming.value) return
  confirming.value = true
  const ok = await dialog.confirm({
    title: `Decline invite to ${props.invite.orgName}?`,
    body: 'You will not join this org.',
    confirmLabel: 'Decline',
  })
  confirming.value = false
  if (!ok) return

  busy.value = true
  error.value = ''
  try {
    await api.post(invitePath('decline'))
    noteOneLessInvite()
    emit('declined', props.invite.orgId)
  } catch (err) {
    rememberFailure(err, 'Could not decline this invite. Try again.')
  } finally {
    busy.value = false
  }
}
</script>

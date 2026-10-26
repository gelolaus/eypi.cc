<template>
  <AppPage
    title="Invites"
    class="!max-w-3xl"
  >
    <p
      v-if="loadError"
      role="alert"
      class="text-sm text-red-600 dark:text-red-400"
    >
      {{ loadError }}
    </p>
    <PageSkeleton v-else-if="loading" />
    <p
      v-else-if="invites.length === 0"
      class="text-sm text-g-muted"
    >
      No pending invites.
    </p>
    <div
      v-else
      class="flex flex-col gap-4"
    >
      <InviteCard
        v-for="invite in invites"
        :key="invite.orgId"
        :invite="invite"
        @declined="removeInvite"
      />
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import InviteCard from '@/components/orgs/InviteCard.vue'
import { loadPendingInvites, type OrgInvite } from '@/components/orgs/invites'
import { ApiError } from '@/lib/api'

const invites = ref<OrgInvite[]>([])
const loading = ref(true)
const loadError = ref('')

function removeInvite(orgId: string) {
  invites.value = invites.value.filter((invite) => invite.orgId !== orgId)
}

onMounted(async () => {
  try {
    invites.value = await loadPendingInvites()
  } catch (err) {
    loadError.value = err instanceof ApiError ? err.message : 'Could not load invites. Try again.'
  } finally {
    loading.value = false
  }
})
</script>

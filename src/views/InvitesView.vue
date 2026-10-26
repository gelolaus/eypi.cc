<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col px-4 py-12 sm:px-6 lg:px-8">
    <header class="mb-8 border-b border-g-border pb-8">
      <h1 class="text-page-title">
        Invites
      </h1>
    </header>

    <p
      v-if="loadError"
      role="alert"
      class="text-sm text-red-500"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="!loading && invites.length === 0"
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
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
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

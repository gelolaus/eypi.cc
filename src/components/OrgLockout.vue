<template>
  <div class="flex w-full flex-col items-center justify-center px-4 py-8 sm:py-12">
    <div
      class="mica-card relative flex w-full max-w-xl flex-col items-center rounded-3xl border border-gray-200 p-6 text-center shadow-xl sm:p-12 dark:border-slate-700"
    >

      <div class="mb-4 text-[#ef4444]">
        <svg xmlns="http://www.w3.org/2000/svg" class="size-14 sm:size-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h1 class="text-section-title mb-2 text-[#34418F] dark:text-slate-200">
        Access restricted
      </h1>

      <p class="mb-6 text-sm leading-relaxed text-gray-500 dark:text-slate-400">
        This feature is for active student-organization members only.
      </p>

      <p
        v-if="loadError"
        role="alert"
        class="mb-4 text-sm text-red-600 dark:text-red-400"
      >
        {{ loadError }}
      </p>

      <div
        v-if="invites.length > 0"
        class="flex w-full flex-col gap-3"
      >
        <InviteCard
          v-for="invite in invites"
          :key="invite.orgId"
          :invite="invite"
          @declined="removeInvite"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InviteCard from '@/components/orgs/InviteCard.vue'
import { loadPendingInvites, type OrgInvite } from '@/components/orgs/invites'
import { ApiError } from '@/lib/api'

const invites = ref<OrgInvite[]>([])
const loadError = ref('')

function removeInvite(orgId: string) {
  invites.value = invites.value.filter((invite) => invite.orgId !== orgId)
}

onMounted(async () => {
  try {
    invites.value = await loadPendingInvites()
  } catch (err) {
    loadError.value = err instanceof ApiError ? err.message : 'Could not load invites. Try again.'
  }
})
</script>

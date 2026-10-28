<template>
  <div class="flex w-full flex-col items-center justify-center px-4 py-8 sm:py-12">
    <Card class="w-full max-w-xl items-center gap-4 rounded-3xl bg-card/80 p-6 text-center shadow-2xl sm:p-12">
      <div class="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert
          class="size-7"
          aria-hidden="true"
        />
      </div>

      <h1 class="font-display text-3xl font-semibold tracking-tight">
        Access restricted
      </h1>

      <p class="text-base leading-relaxed text-muted-foreground">
        This feature is for active student-organization members only.
      </p>

      <p
        v-if="loadError"
        role="alert"
        class="w-full rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive"
      >
        {{ loadError }}
      </p>

      <div
        v-if="invites.length > 0"
        class="flex w-full flex-col gap-3 text-left"
      >
        <InviteCard
          v-for="invite in invites"
          :key="invite.orgId"
          :invite="invite"
          @declined="removeInvite"
        />
      </div>

      <Button
        v-else-if="loaded"
        as-child
        variant="outline"
        class="w-full sm:w-auto"
      >
        <router-link to="/orgs">
          Browse orgs
        </router-link>
      </Button>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ShieldAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import InviteCard from '@/components/orgs/InviteCard.vue'
import { loadPendingInvites, type OrgInvite } from '@/components/orgs/invites'
import { ApiError } from '@/lib/api'

const invites = ref<OrgInvite[]>([])
const loadError = ref('')
const loaded = ref(false)

function removeInvite(orgId: string) {
  invites.value = invites.value.filter((invite) => invite.orgId !== orgId)
}

onMounted(async () => {
  try {
    invites.value = await loadPendingInvites()
  } catch (err) {
    loadError.value = err instanceof ApiError ? err.message : 'Could not load invites. Try again.'
  } finally {
    loaded.value = true
  }
})
</script>

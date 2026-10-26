<template>
  <Card class="gap-0 rounded-3xl p-6 shadow-sm sm:p-8">
    <h2 class="font-heading text-xl font-semibold tracking-tight">
      Account
    </h2>
    <p class="mt-4 text-sm text-muted-foreground">
      Signed in as <span class="font-mono">{{ email }}</span>.
    </p>
    <p class="mt-2 text-sm text-muted-foreground">
      This account uses your APC Microsoft 365 sign-in.
    </p>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'
import { useSession } from '@/stores/session'

const session = useSession()
const email = computed(() => session.user.value?.email ?? '')
</script>

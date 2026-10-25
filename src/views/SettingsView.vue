<template>
  <section class="mica-card rounded-3xl p-6 shadow-sm sm:p-8">
    <h2 class="text-section-title text-g-text">
      Account
    </h2>
    <p class="mt-4 text-sm text-g-muted">
      Signed in as <span class="text-data">{{ email }}</span>.
    </p>
    <p class="mt-2 text-sm text-g-muted">
      This account uses your APC Microsoft 365 sign-in.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '@/stores/session'

const session = useSession()
const email = computed(() => session.user.value?.email ?? '')
</script>

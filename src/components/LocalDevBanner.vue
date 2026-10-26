<template>
  <div
    v-if="IS_LOCAL_DEV"
    class="relative z-[9991] shrink-0 border-b border-border bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground"
    role="status"
    aria-live="polite"
  >
    <span>Local dev</span>
    <span
      class="mx-2 opacity-50"
      aria-hidden="true"
    >·</span>
    <span class="normal-case tracking-normal">{{ API_BASE_URL }}</span>
    <span
      class="mx-2 opacity-50"
      aria-hidden="true"
    >·</span>
    <span :class="statusClass">{{ statusLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import { ref, computed, onMounted } from 'vue'
import { API_BASE_URL, IS_LOCAL_DEV } from '@/config/api'

type HealthStatus = 'checking' | 'online' | 'offline' | 'misconfigured'

const status = ref<HealthStatus>('checking')
const statusDetail = ref('')

const statusLabel = computed(() => {
  if (status.value === 'checking') return 'Checking API…'
  if (status.value === 'online') return 'API online'
  if (status.value === 'misconfigured') return statusDetail.value || 'API misconfigured. Check backend/.dev.vars.'
  return 'API unreachable. Run npm run dev:local.'
})

const statusClass = computed(() =>
  status.value === 'online'
    ? 'font-bold'
    : status.value === 'offline' || status.value === 'misconfigured'
      ? 'font-bold underline underline-offset-2'
      : '',
)

onMounted(async () => {
  if (!IS_LOCAL_DEV) return
  try {
    const res = await api.raw(`/api/health`)
    if (res.ok) {
      status.value = 'online'
      return
    }
    const detail = (await res.text()).trim()
    if (detail.includes('Missing required secrets')) {
      status.value = 'misconfigured'
      statusDetail.value = detail.replace('Missing required secrets in backend/.dev.vars: ', 'Missing in .dev.vars: ')
      return
    }
    status.value = 'offline'
  } catch {
    status.value = 'offline'
  }
})
</script>

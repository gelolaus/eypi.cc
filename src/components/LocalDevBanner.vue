<template>
  <div
    v-if="IS_LOCAL_DEV"
    class="fixed inset-x-0 top-0 z-[9991] border-b border-amber-500/40 bg-amber-500/95 px-3 py-1.5 text-center font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-amber-950 shadow-sm backdrop-blur-sm dark:bg-amber-600/90 dark:text-amber-50"
    role="status"
    aria-live="polite"
  >
    <span>Local dev</span>
    <span class="mx-2 opacity-50" aria-hidden="true">·</span>
    <span class="normal-case tracking-normal">{{ API_BASE_URL }}</span>
    <span class="mx-2 opacity-50" aria-hidden="true">·</span>
    <span :class="statusClass">{{ statusLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE_URL, IS_LOCAL_DEV } from '@/config/api'

type HealthStatus = 'checking' | 'online' | 'offline' | 'misconfigured'

const status = ref<HealthStatus>('checking')
const statusDetail = ref('')

const statusLabel = computed(() => {
  if (status.value === 'checking') return 'Checking API…'
  if (status.value === 'online') return 'API online'
  if (status.value === 'misconfigured') return statusDetail.value || 'API misconfigured — check backend/.dev.vars'
  return 'API unreachable — run npm run dev:local'
})

const statusClass = computed(() =>
  status.value === 'online'
    ? 'text-emerald-950 dark:text-emerald-100'
    : status.value === 'offline' || status.value === 'misconfigured'
      ? 'text-red-950 dark:text-red-100'
      : '',
)

onMounted(async () => {
  if (!IS_LOCAL_DEV) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`)
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

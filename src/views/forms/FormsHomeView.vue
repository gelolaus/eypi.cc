<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col min-h-[calc(100vh-5rem)]">
    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div v-for="i in 2" :key="i" class="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <!-- Lockout state -->
    <div v-else-if="isLocked" class="flex-1 flex items-center justify-center">
      <OrgLockout />
    </div>

    <template v-else>
      <!-- Search input -->
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search forms..."
        class="w-full rounded-2xl px-6 py-4 font-mono text-sm mb-6 outline-none transition-colors duration-200"
        :style="{
          border: '2px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
        }"
        @focus="(e) => (e.target as HTMLInputElement).style.borderColor = '#34418F'"
        @blur="(e) => (e.target as HTMLInputElement).style.borderColor = 'var(--color-border)'"
      />

      <!-- Grid of form cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          v-for="form in filteredForms"
          :key="form.id"
          type="button"
          @click="router.push(form.route)"
          class="mica-card rounded-2xl p-6 text-left transition-all duration-200 focus:outline-none hover:-translate-y-0.5"
          :style="{
            border: '1px solid var(--color-border)',
          }"
          @mouseenter="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(222,172,75,0.5)'"
          @mouseleave="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'"
        >
          <h2 class="font-mono text-xl font-semibold uppercase tracking-[0.1em] mb-2 text-[#34418F] dark:text-white">
            {{ form.title }}
          </h2>
          <p class="font-mono text-sm" style="color: var(--color-text-muted);">
            {{ form.description }}
          </p>
        </button>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import OrgLockout from '@/components/OrgLockout.vue'

const router = useRouter()
const { authHeaders } = useAuth()

const loading = ref(true)
const isLocked = ref(false)

const availableForms = [
  {
    id: 'concessionaire',
    title: 'Concessionaire Form',
    description: 'Generate official concessionaire documents.',
    route: '/forms/concessionaire',
  },
  {
    id: 'visitors-pass',
    title: 'Visitors Pass',
    description: 'Generate a visitors pass from a CSV list of names.',
    route: '/forms/visitors-pass',
  },
  {
    id: 'letter-of-intent',
    title: 'Letter of Intent & Waiver',
    description: 'Batch generate student waivers into a ZIP file from a CSV list.',
    route: '/forms/letter-of-intent',
  },
]

const searchQuery = ref('')

const filteredForms = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return availableForms
  return availableForms.filter(
    (f) =>
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, { headers: authHeaders() })
    if (res.status === 403) {
      isLocked.value = true
      return
    }
    const data = await res.json()
    if (res.ok) {
      const orgsList = data.orgs || []
      if (orgsList.length === 0) {
        isLocked.value = true
      }
    } else {
      isLocked.value = true
    }
  } catch {
    isLocked.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col min-h-[calc(100vh-5rem)]">
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div v-for="i in 2" :key="i" class="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <template v-else>
      <header class="mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            class="font-mono font-black tracking-tight text-g-primary dark:text-slate-200"
            style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.03em;"
            data-cursor="text"
          >
            Forms
          </h1>
          <p class="mt-1 font-mono text-xs uppercase tracking-widest text-g-muted">
            Generate organization documents
          </p>
        </div>
      </header>

      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search forms..."
        class="mb-6 w-full rounded-2xl border-2 border-g-border bg-g-surface px-6 py-4 font-mono text-sm text-g-text outline-none transition-colors duration-200 placeholder:text-g-muted focus:border-g-accent"
      />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          v-for="form in filteredForms"
          :key="form.id"
          type="button"
          @click="router.push(form.route)"
          class="mica-card rounded-2xl border border-g-border p-6 text-left transition-all duration-200 focus:outline-none hover:-translate-y-0.5 hover:border-g-accent/50"
        >
          <h2 class="mb-2 font-mono text-xl font-semibold uppercase tracking-[0.1em] text-g-primary dark:text-white">
            {{ form.title }}
          </h2>
          <p class="font-mono text-sm text-g-muted">
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

interface FormCatalogItem {
  id: string
  title: string
  description: string
  route: string
}

const FALLBACK_FORMS: FormCatalogItem[] = [
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

const router = useRouter()
const { authHeaders } = useAuth()

const loading = ref(true)
const availableForms = ref<FormCatalogItem[]>(FALLBACK_FORMS)

const searchQuery = ref('')

const filteredForms = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return availableForms.value
  return availableForms.value.filter(
    (f) =>
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/forms`, { headers: authHeaders() })
    if (res.ok) {
      const data = await res.json() as { forms?: FormCatalogItem[] }
      if (data.forms?.length) {
        availableForms.value = data.forms
      }
    }
  } catch {
    // Keep static fallback catalog; org access is enforced by FormsLayout
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="mx-auto flex w-full max-w-5xl flex-col px-4 py-12 sm:px-6 lg:px-8">
    <div v-if="loading" class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card v-for="i in 2" :key="i" className="h-32 animate-pulse" />
    </div>

    <template v-else>
      <header class="mb-8">
        <h1 class="font-display text-3xl font-bold text-g-text">Forms</h1>
        <p class="mt-2 text-g-muted">Generate organization documents.</p>
      </header>

      <Input
        :value="searchQuery"
        type="search"
        placeholder="Search forms..."
        className="mb-6"
        @input="onSearchInput"
      />

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card
          v-for="form in filteredForms"
          :key="form.id"
          role="button"
          tabindex="0"
          className="cursor-pointer text-left transition hover:-translate-y-1 hover:border-g-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          @click="router.push(form.route)"
          @keydown.enter.prevent="router.push(form.route)"
          @keydown.space.prevent="router.push(form.route)"
        >
          <h2 class="font-display text-xl font-semibold text-g-text">{{ form.title }}</h2>
          <p class="mt-2 text-sm text-g-muted">{{ form.description }}</p>
        </Card>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'

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
    description: 'MOA, waiver, reply form, and related docs in one ZIP.',
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
      f.description.toLowerCase().includes(q),
  )
})

function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
}

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

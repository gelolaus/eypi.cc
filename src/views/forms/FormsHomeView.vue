<template>
  <PageSkeleton v-if="loading" />
  <AppPage
    v-else
    title="Forms"
    description="Generate organization documents."
  >
    <Input
      v-model="searchQuery"
      type="search"
      placeholder="Search forms..."
      aria-label="Search forms"
      class="mb-6 w-full"
    />

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <Card
        v-for="form in filteredForms"
        :key="form.id"
        class="relative min-h-11 gap-0 rounded-2xl p-5 transition-shadow hover:ring-foreground/30 sm:p-6"
      >
        <h2 class="mb-2 text-lg font-semibold">
          <button
            type="button"
            class="text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            @click="router.push(form.route)"
          >
            {{ form.title }}
          </button>
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ form.description }}
        </p>
      </Card>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { FORM_CATALOG, type FormCatalogItem } from '@shared/formsCatalog'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = ref(true)
const availableForms = ref<FormCatalogItem[]>(FORM_CATALOG.map((form) => ({ ...form })))

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
    const res = await api.raw(`/api/forms`)
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

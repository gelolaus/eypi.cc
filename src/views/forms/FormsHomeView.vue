<template>
  <PageSkeleton v-if="loading" />
  <AppPage v-else title="Forms" description="Generate organization documents.">
    <input
      v-model="searchQuery"
      type="search"
      placeholder="Search forms..."
      aria-label="Search forms"
      class="control mb-6 w-full"
    />

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <button
        v-for="form in filteredForms"
        :key="form.id"
        type="button"
        class="mica-card min-h-11 rounded-2xl border border-g-border p-5 text-left transition-all duration-200 hover:border-g-accent/50 sm:p-6"
        @click="router.push(form.route)"
      >
        <h2 class="text-card-title mb-2 text-g-primary dark:text-white">
          {{ form.title }}
        </h2>
        <p class="text-sm text-g-muted">
          {{ form.description }}
        </p>
      </button>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
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

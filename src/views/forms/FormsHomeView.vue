<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col min-h-[calc(100vh-5rem)]">
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
  </main>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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
</script>

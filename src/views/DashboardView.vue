<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col min-h-[calc(100vh-5rem)]">
    <header class="mb-10 reveal border-b border-g-border pb-8">
      <h1 class="font-mono text-3xl sm:text-4xl font-semibold tracking-tight text-g-primary dark:text-slate-200">
        {{ userName ? `Hi, ${userName}` : 'Hi' }}.
      </h1>
      <p class="font-mono text-sm mt-3 text-g-muted">
        Choose a module to launch.
      </p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <button
        v-for="mod in modules"
        :key="mod.id"
        type="button"
        @click="router.push(mod.route)"
        class="mica-card rounded-2xl p-7 text-left transition-all duration-200 focus:outline-none hover:-translate-y-1 reveal flex flex-col gap-4"
        :style="{ border: '1px solid var(--color-border)' }"
        @mouseenter="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(222,172,75,0.5)'"
        @mouseleave="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'"
      >
        <h2 class="font-mono text-2xl font-semibold uppercase tracking-[0.1em] text-g-primary dark:text-white">
          {{ mod.title }}
        </h2>
        <p class="font-mono text-sm text-g-muted">
          {{ mod.description }}
        </p>
        <span class="font-mono text-xs mt-auto pt-4 text-g-muted">
          Launch ->
        </span>
      </button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReveal } from '@/composables/useReveal'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { getUser } = useAuth()
useReveal()

const userName = ref('')
onMounted(() => {
  const user = getUser()
  if (user?.name) userName.value = user.name
})

const modules = [
  {
    id: 'links',
    title: 'Links',
    description: 'Shorten URLs and track click analytics by OS, country, and referrer.',
    route: '/links',
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Generate MOAs, letters of intent, and printable event documents.',
    route: '/forms',
  },
  {
    id: 'ticketing',
    title: 'Event Tickets',
    description: 'Create events, manage guest lists, and run QR-code check-in.',
    route: '/manage/tix',
  },
  {
    id: 'frames',
    title: 'Frames',
    description: 'Upload a frame and share a link so anyone can make a matching profile picture.',
    route: '/manage/frames',
  },
]
</script>


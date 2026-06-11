<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col min-h-[calc(100vh-5rem)]">
    <!-- Greeting -->
    <header class="mb-10 reveal">
      <p class="font-mono text-xs uppercase tracking-[0.3em] mb-3" style="color: var(--color-text-muted);">
        eypi.cc suite
      </p>
      <h1 class="font-mono text-3xl sm:text-4xl font-semibold tracking-tight" style="color: var(--color-text);">
        Welcome back<span v-if="userName">, {{ userName }}</span>.
      </h1>
      <p class="font-mono text-sm mt-3" style="color: var(--color-text-muted);">
        Choose a module to launch.
      </p>
    </header>

    <!-- Module launcher -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <button
        v-for="mod in modules"
        :key="mod.id"
        type="button"
        @click="router.push(mod.route)"
        class="mica-card rounded-2xl p-7 text-left transition-all duration-200 focus:outline-none hover:-translate-y-1 reveal flex flex-col gap-3"
        :style="{ border: '1px solid var(--color-border)' }"
        @mouseenter="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(222,172,75,0.5)'"
        @mouseleave="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'"
      >
        <span class="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-[#DEAC4B]">
          {{ mod.tag }}
        </span>
        <h2 class="font-mono text-xl font-semibold uppercase tracking-[0.1em] text-[#34418F] dark:text-white">
          {{ mod.title }}
        </h2>
        <p class="font-mono text-sm" style="color: var(--color-text-muted);">
          {{ mod.description }}
        </p>
        <span class="font-mono text-xs mt-auto pt-3" style="color: var(--color-text-muted);">
          Launch →
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
    tag: 'Shortener',
    title: 'Links',
    description: 'Shorten URLs and track click analytics by OS, country, and referrer.',
    route: '/links',
  },
  {
    id: 'forms',
    tag: 'Documents',
    title: 'Forms',
    description: 'Generate MOAs, letters of intent, and printable event documents.',
    route: '/forms',
  },
  {
    id: 'ticketing',
    tag: 'Events',
    title: 'Ticketing',
    description: 'Create events, manage guest lists, and run QR-code check-in.',
    route: '/events',
  },
  {
    id: 'dp-blast',
    tag: 'Profile Frames',
    title: 'DP Blast',
    description: 'Upload a frame and share a link so anyone can make a matching profile picture.',
    route: '/manage/dp-blast',
  },
]
</script>

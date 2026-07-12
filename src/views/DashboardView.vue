<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col min-h-[calc(100vh-5rem)]">
    <header class="mb-10 border-b border-g-border pb-8">
      <h1 class="text-page-title">
        {{ userName ? `Hi, ${userName}` : 'Hi' }}.
      </h1>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <button
        v-for="mod in modules"
        :key="mod.id"
        type="button"
        @click="router.push(mod.route)"
        class="mica-card rounded-2xl p-7 text-left transition-all duration-200 focus:outline-none hover:-translate-y-1 flex flex-col gap-4"
        data-cursor="card"
        :style="{ border: '1px solid var(--color-border)' }"
        @mouseenter="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(222,172,75,0.5)'"
        @mouseleave="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'"
      >
        <h2 class="text-card-title text-g-primary dark:text-white">
          {{ mod.title }}
        </h2>
        <p class="text-sm text-g-muted">
          {{ mod.description }}
        </p>
      </button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { getUser } = useAuth()

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
    title: 'Tix',
    description: 'Create events, manage guest lists, and run QR-code check-in.',
    route: '/manage/tix',
  },
  {
    id: 'frames',
    title: 'Frames',
    description: 'Upload a frame and share a link so anyone can make a matching profile picture.',
    route: '/manage/frames',
  },
  {
    id: 'orgs',
    title: 'Orgs',
    description: 'Edit your organization profile, manage members, and control public directory visibility.',
    route: '/orgs',
  },
]
</script>

<template>
  <main class="mx-auto flex w-full max-w-5xl flex-col px-4 py-12 sm:px-6 lg:px-8 min-h-[calc(100vh-5rem)]">
    <header>
      <h1 class="font-display text-3xl font-bold text-g-text">
        Good {{ period }}, {{ userName }}
      </h1>
      <p class="mt-2 text-g-muted">Jump into a module.</p>
    </header>

    <div class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="mod in visibleModules"
        :key="mod.id"
        role="button"
        tabindex="0"
        className="cursor-pointer transition hover:-translate-y-1 hover:border-g-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        @click="router.push(mod.route)"
        @keydown.enter.prevent="router.push(mod.route)"
        @keydown.space.prevent="router.push(mod.route)"
      >
        <h2 class="font-display text-xl font-semibold text-g-text">{{ mod.title }}</h2>
        <p class="mt-2 text-sm text-g-muted">{{ mod.description }}</p>
      </Card>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useOrgMembership } from '@/composables/useOrgMembership'
import Card from '@/components/ui/Card.vue'

const router = useRouter()
const { getUser } = useAuth()
const { checkOrgMembership } = useOrgMembership()

const userName = ref('')
const hasOrgMembership = ref(false)

const period = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
})

interface DashModule {
  id: string
  title: string
  description: string
  route: string
  requiresOrg?: boolean
}

const modules: DashModule[] = [
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
    requiresOrg: true,
  },
  {
    id: 'ticketing',
    title: 'Tix',
    description: 'Create events, manage guest lists, and run QR-code check-in.',
    route: '/manage/tix',
    requiresOrg: true,
  },
  {
    id: 'frames',
    title: 'Frames',
    description: 'Upload a frame and share a link so anyone can make a matching profile picture.',
    route: '/manage/frames',
    requiresOrg: true,
  },
  {
    id: 'orgs',
    title: 'Orgs',
    description: 'Edit your organization profile, manage members, and control public directory visibility.',
    route: '/orgs',
    requiresOrg: true,
  },
]

const visibleModules = computed(() =>
  modules.filter((mod) => !mod.requiresOrg || hasOrgMembership.value),
)

onMounted(async () => {
  const user = getUser()
  userName.value = user?.name?.trim() || 'there'
  hasOrgMembership.value = await checkOrgMembership()
})
</script>

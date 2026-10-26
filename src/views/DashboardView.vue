<template>
  <AppPage :title="userName ? `Hi, ${userName}.` : 'Hi.'">
    <div
      v-if="pendingInviteCount > 0"
      class="mb-6 rounded-2xl border border-[#DEAC4B]/50 bg-[#DEAC4B]/10 px-5 py-4 text-sm text-g-text"
      role="status"
    >
      <p>
        {{ inviteBanner }}
        <router-link
          to="/invites"
          class="inline-flex min-h-11 items-center font-semibold text-g-primary underline decoration-[#DEAC4B] underline-offset-4 dark:text-[#8FA0E8]"
        >
          Review invites
        </router-link>
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      <router-link
        v-for="mod in modules"
        :key="mod.id"
        :to="mod.route"
        class="section-card flex min-h-11 flex-col gap-2 p-6 text-left transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] active:translate-y-px [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#DEAC4B]/60"
      >
        <h2 class="text-xl font-semibold tracking-tight text-g-primary dark:text-white">
          {{ mod.title }}
        </h2>
        <p class="text-sm text-g-muted">
          {{ mod.description }}
        </p>
      </router-link>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppPage from '@/components/layout/AppPage.vue'
import { useSession } from '@/stores/session'

const session = useSession()

const userName = computed(() => session.user.value?.name ?? '')
const pendingInviteCount = computed(() => session.pendingInviteCount.value)
const inviteBanner = computed(() => {
  const count = pendingInviteCount.value
  const noun = count === 1 ? 'invite' : 'invites'
  return `You have ${count} pending org ${noun}.`
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

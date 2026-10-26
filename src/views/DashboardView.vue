<template>
  <AppPage :title="userName ? `Hi, ${userName}.` : 'Hi.'">
    <Card
      v-if="pendingInviteCount > 0"
      class="border border-primary/40 bg-primary/10 px-5 py-4 text-base text-foreground"
      role="status"
    >
      <p>
        {{ inviteBanner }}
        <router-link
          to="/invites"
          class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Review invites
        </router-link>
      </p>
    </Card>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      <router-link
        v-for="mod in modules"
        :key="mod.id"
        :to="mod.route"
        class="group/module block min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card class="h-full min-h-11 gap-2 p-6 text-left transition-colors group-active/module:translate-y-px [@media(hover:hover)_and_(pointer:fine)]:group-hover/module:bg-muted">
          <h2 class="text-xl font-semibold tracking-tight text-foreground">
            {{ mod.title }}
          </h2>
          <p class="text-base text-muted-foreground">
            {{ mod.description }}
          </p>
        </Card>
      </router-link>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'
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

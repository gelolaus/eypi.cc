<template>
  <Dialog
    :open="drawer.isOpen.value"
    @update:open="onOpenChange"
  >
    <DialogContent
      id="site-nav-sidebar"
      class="top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none p-6 pt-16 sm:max-w-md"
    >
      <DialogTitle class="sr-only">
        Site navigation
      </DialogTitle>
      <DialogDescription class="sr-only">
        Pages and account actions
      </DialogDescription>

      <template v-if="isAuthenticated">
        <nav
          class="flex flex-col gap-1"
          aria-label="App modules"
        >
          <router-link
            v-for="entry in entries"
            :key="entry.to"
            :to="entry.to"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            @click="drawer.close"
          >
            <component
              :is="entry.icon"
              class="size-5 shrink-0"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
            <Badge
              v-if="entry.to === '/invites' && inviteCount > 0"
              :aria-label="`${inviteCount} pending ${inviteCount === 1 ? 'invite' : 'invites'}`"
            >
              {{ inviteCount }}
            </Badge>
            <Badge
              v-if="entry.to === '/tickets' && ticketCount > 0"
              data-ticket-updates
            >
              <span aria-hidden="true">{{ ticketBadge }}</span>
              <span class="sr-only">{{ ticketCount }} new {{ ticketCount === 1 ? 'update' : 'updates' }}</span>
            </Badge>
          </router-link>
        </nav>
        <Button
          variant="outline"
          class="mt-6 h-11 w-full"
          @click="signOut"
        >
          Sign out
        </Button>
      </template>

      <nav
        v-else
        class="flex flex-col gap-1"
        aria-label="Public navigation"
      >
        <template
          v-for="link in publicLinks"
          :key="link.to"
        >
          <Button
            v-if="link.cta"
            as-child
            size="lg"
            class="mt-3 h-12 w-full"
          >
            <router-link
              :to="link.to"
              @click="drawer.close"
            >
              {{ link.label }}
            </router-link>
          </Button>
          <router-link
            v-else
            :to="link.to"
            class="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-base font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            @click="drawer.close"
          >
            {{ link.label }}
          </router-link>
        </template>
      </nav>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { navItems } from '@/config/nav'
import { useSession } from '@/stores/session'
import { appNav, menuEntries } from './appNav'
import { useSignOut } from './useSignOut'

const route = useRoute()
const session = useSession()
const drawer = useNavDrawer()
const signOut = useSignOut()

const isAuthenticated = computed(() => session.user.value !== null)
const inviteCount = computed(() => session.pendingInviteCount.value)
const ticketCount = computed(() => session.ticketUpdates.value)
const ticketBadge = computed(() => (ticketCount.value > 9 ? '9+' : String(ticketCount.value)))
const entries = computed(() => {
  const admin = session.user.value?.role === 'admin'
  return [...appNav({ admin }), ...menuEntries({ admin })]
})
const publicLinks = navItems({ authenticated: false, admin: false })

function onOpenChange(open: boolean) {
  if (!open) drawer.close()
}

watch(() => route.path, () => drawer.close())
</script>

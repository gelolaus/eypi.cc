<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      :data-account-menu="variant"
      :aria-label="triggerLabel"
      :class="cn(
        'outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50',
        header
          ? 'relative flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-0.5 pr-2 hover:bg-muted'
          : 'flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-muted',
      )"
    >
      <Avatar :class="header ? 'size-8' : 'size-11'">
        <AvatarFallback class="text-sm font-medium">
          {{ initials }}
        </AvatarFallback>
      </Avatar>
      <span
        v-if="!header"
        class="min-w-0 flex-1"
      >
        <span class="line-clamp-2 text-base font-semibold leading-snug tracking-tight">{{ displayName }}</span>
      </span>
      <ChevronDown
        v-else
        aria-hidden="true"
        class="size-4 shrink-0 text-muted-foreground"
      />
      <span
        v-if="header && inviteCount > 0"
        class="pointer-events-none absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-primary"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>

    <DropdownMenuContent
      :align="header ? 'end' : 'start'"
      :side="header ? 'bottom' : 'top'"
      class="w-72 min-w-72 p-2"
    >
      <div class="flex items-center gap-3 px-2 py-3">
        <Avatar class="size-12 shrink-0">
          <AvatarFallback class="text-base font-medium">
            {{ initials }}
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0">
          <p class="truncate text-base font-semibold tracking-tight">
            {{ displayName }}
          </p>
          <p
            v-if="email"
            class="truncate text-sm text-muted-foreground"
          >
            {{ email }}
          </p>
        </div>
      </div>
      <DropdownMenuSeparator />

      <template v-if="header && overflow.length > 0">
        <DropdownMenuItem
          v-for="entry in overflow"
          :key="entry.to"
          as-child
          class="rounded-xl px-3 py-3 text-base"
        >
          <router-link :to="entry.to">
            <component
              :is="entry.icon"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
            <Badge
              v-if="entry.to === '/invites' && inviteCount > 0"
              :aria-label="inviteLabel"
            >
              {{ inviteCount }}
            </Badge>
          </router-link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </template>

      <DropdownMenuItem
        v-for="entry in accountEntries"
        :key="entry.to"
        as-child
        class="rounded-xl px-3 py-3 text-base"
      >
        <router-link
          :to="entry.to"
          :aria-current="isAppNavEntryActive(entry, route.path) ? 'page' : undefined"
        >
          <component
            :is="entry.icon"
            aria-hidden="true"
          />
          {{ entry.label }}
        </router-link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="link in legalLinks"
        :key="link.to"
        as-child
        class="rounded-xl px-3 py-3 text-base"
      >
        <router-link :to="link.to">
          {{ link.label }}
        </router-link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        class="rounded-xl px-3 py-3 text-base"
        @select="signOut"
      >
        <LogOut aria-hidden="true" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, LogOut } from 'lucide-vue-next'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { useSession } from '@/stores/session'
import { isAppNavEntryActive, menuEntries, type AppNavEntry } from './appNav'
import { useSignOut } from './useSignOut'

const props = withDefaults(
  defineProps<{
    variant?: 'sidebar' | 'header'
    /** Modules that do not fit in the bottom tabs (header menu only). */
    overflow?: AppNavEntry[]
  }>(),
  { variant: 'sidebar', overflow: () => [] },
)

const legalLinks = [
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

const session = useSession()
const route = useRoute()
const signOut = useSignOut()

const accountEntries = computed(() => menuEntries({ admin: session.user.value?.role === 'admin' }))
const header = computed(() => props.variant === 'header')
const email = computed(() => session.user.value?.email ?? '')
const inviteCount = computed(() => session.pendingInviteCount.value)
const inviteLabel = computed(() => `${inviteCount.value} pending ${inviteCount.value === 1 ? 'invite' : 'invites'}`)

const displayName = computed(() => {
  const current = session.user.value
  if (!current) return 'Account'
  const prefix = current.email ? current.email.split('@')[0] : ''
  const name = current.name?.trim()
  if (name && name.toLowerCase() !== prefix.toLowerCase()) return name
  return prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() : 'Student'
})
const initials = computed(() => displayName.value.slice(0, 2).toUpperCase())

const triggerLabel = computed(() =>
  inviteCount.value > 0
    ? `${displayName.value} account menu, ${inviteLabel.value}`
    : `${displayName.value} account menu`,
)
</script>

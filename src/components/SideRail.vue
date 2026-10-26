<template>
  <aside class="hidden h-full w-56 shrink-0 flex-col border-r border-g-border bg-g-bg lg:flex">
    <div class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-g-border pl-4 pr-2">
      <router-link to="/dashboard" class="text-[0.9375rem] font-bold tracking-tight text-g-primary dark:text-g-text">
        eypi.cc
      </router-link>
    </div>

    <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="App modules">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium"
        :class="isNavActive(item, route.path) ? 'bg-primary/15 text-g-text' : 'text-g-muted hover:bg-g-surface hover:text-g-text'"
        :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
      >
        <NavIcon :name="item.icon" :class="isNavActive(item, route.path) ? 'text-primary' : ''" />
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
        <span
          v-if="item.to === '/invites' && inviteCount > 0"
          class="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#DEAC4B] px-1.5 text-xs font-semibold leading-none text-[#1a1a2e]"
          :aria-label="`${inviteCount} pending ${inviteCount === 1 ? 'invite' : 'invites'}`"
        >
          {{ inviteCount }}
        </span>
      </router-link>
    </nav>

    <div class="flex shrink-0 flex-col gap-2 border-t border-g-border p-3">
      <OrgSwitcher block placement="up" :auto-fetch="false" />
      <button
        type="button"
        data-rail-logout
        class="flex min-h-11 items-center rounded-xl px-3 text-base font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
        @click="$emit('logout')"
      >
        Logout
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import NavIcon from '@/components/NavIcon.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import { isNavActive, type NavItem } from '@/config/nav'

defineProps<{
  items: NavItem[]
  inviteCount: number
}>()

defineEmits<{ logout: [] }>()

const route = useRoute()
</script>

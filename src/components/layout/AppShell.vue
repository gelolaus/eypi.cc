<template>
  <div class="flex h-dvh flex-col bg-g-bg lg:flex-row">
    <!-- Desktop sidebar -->
    <aside
      :class="
        cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-g-border bg-g-bg/95 lg:flex',
          dense ? 'w-16' : 'w-56',
        )
      "
    >
      <div
        :class="
          cn(
            'flex h-16 items-center border-b border-g-border px-3',
            dense ? 'justify-center' : 'px-4',
          )
        "
      >
        <router-link
          to="/dashboard"
          :class="
            cn(
              'font-display font-bold tracking-tight text-g-text',
              dense ? 'text-sm' : 'text-lg',
            )
          "
          title="eypi.cc"
        >
          {{ dense ? 'e' : 'eypi.cc' }}
        </router-link>
      </div>

      <nav class="flex flex-1 flex-col gap-1 p-2" aria-label="App">
        <router-link
          v-for="item in nav.desktop"
          :key="item.id"
          :to="item.href"
          :title="item.label"
          :class="
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition',
              dense && 'justify-center px-0',
              isAppNavActive(item.href, route.path)
                ? 'bg-g-primary/15 text-g-text'
                : 'text-g-muted hover:bg-g-bg hover:text-g-text',
            )
          "
        >
          <NavIcon
            :name="item.icon"
            :class-name="
              isAppNavActive(item.href, route.path) ? 'text-g-primary' : undefined
            "
          />
          <span v-if="!dense">{{ item.label }}</span>
          <span v-else class="sr-only">{{ item.label }}</span>
        </router-link>
      </nav>

      <div
        :class="cn('border-t border-g-border p-3', dense && 'flex justify-center')"
      >
        <AccountMenu
          :user-name="userName"
          :user-email="userEmail"
          :orgs="orgs"
          :active-org="activeOrg"
          :compact="dense"
          @select-org="$emit('selectOrg', $event)"
          @logout="$emit('logout')"
        />
      </div>
    </aside>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <!-- Mobile top bar -->
      <header
        class="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-g-border bg-g-bg/90 px-4 backdrop-blur-md lg:hidden"
      >
        <router-link
          to="/dashboard"
          class="font-display text-lg font-bold tracking-tight text-g-text"
        >
          eypi.cc
        </router-link>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu
            :user-name="userName"
            :user-email="userEmail"
            :orgs="orgs"
            :active-org="activeOrg"
            menu-side="bottom"
            align="end"
            @select-org="$emit('selectOrg', $event)"
            @logout="$emit('logout')"
          />
        </div>
      </header>

      <main
        id="app-content"
        :class="
          cn(
            'min-h-0 flex-1',
            dense
              ? 'overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0'
              : 'overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0',
          )
        "
      >
        <slot />
      </main>

      <!-- Mobile bottom tabs -->
      <nav
        class="fixed inset-x-0 bottom-0 z-40 border-t border-g-border bg-g-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Primary"
      >
        <div
          class="grid h-[4.5rem]"
          :style="{
            gridTemplateColumns: `repeat(${nav.mobilePrimary.length}, minmax(0, 1fr))`,
          }"
        >
          <template v-for="item in nav.mobilePrimary" :key="item.id">
            <button
              v-if="item.id === 'org-tools'"
              type="button"
              :class="
                cn(
                  'flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition',
                  orgToolsOpen
                    ? 'bg-g-primary/15 text-g-text'
                    : 'text-g-muted hover:text-g-text',
                )
              "
              @click="orgToolsOpen = true"
            >
              <NavIcon
                :name="item.icon"
                :class-name="orgToolsOpen ? 'text-g-primary' : undefined"
              />
              <span>{{ item.label }}</span>
            </button>
            <router-link
              v-else
              :to="item.href"
              :class="
                cn(
                  'flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition',
                  isAppNavActive(item.href, route.path)
                    ? 'bg-g-primary/15 text-g-text'
                    : 'text-g-muted hover:text-g-text',
                )
              "
            >
              <NavIcon
                :name="item.icon"
                :class-name="
                  isAppNavActive(item.href, route.path) ? 'text-g-primary' : undefined
                "
              />
              <span>{{ item.label }}</span>
            </router-link>
          </template>
        </div>
      </nav>
    </div>

    <OrgToolsSheet
      :open="orgToolsOpen"
      :items="nav.orgTools"
      @close="orgToolsOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AccountMenu from '@/components/layout/AccountMenu.vue'
import NavIcon from '@/components/layout/NavIcon.vue'
import OrgToolsSheet from '@/components/layout/OrgToolsSheet.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import {
  isAppNavActive,
  isDenseEditorPath,
  resolveAppNav,
} from '@/components/layout/app-nav'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { cn } from '@/lib/cn'
import type { OrgListItem } from '@/types/orgs'

const props = defineProps<{
  userName: string
  userEmail: string
  hasOrgTools: boolean
  orgs: OrgListItem[]
  activeOrg: OrgListItem | null
}>()

defineEmits<{
  selectOrg: [org: OrgListItem]
  logout: []
}>()

const route = useRoute()
const { checkOrgMembership, clearOrgMembershipCache } = useOrgMembership()

const orgToolsEnabled = ref(props.hasOrgTools)
const orgToolsOpen = ref(false)

const dense = computed(() => isDenseEditorPath(route.path))
const nav = computed(() => resolveAppNav({ hasOrgTools: orgToolsEnabled.value }))

watch(
  () => props.hasOrgTools,
  (value) => {
    orgToolsEnabled.value = value
  },
)

watch(
  () => route.path,
  () => {
    orgToolsOpen.value = false
  },
)

onMounted(async () => {
  orgToolsEnabled.value = await checkOrgMembership()
  if (!orgToolsEnabled.value && props.orgs.length > 0) {
    clearOrgMembershipCache()
    orgToolsEnabled.value = await checkOrgMembership()
  }
})

watch(
  () => props.orgs.length,
  async (len) => {
    if (len > 0 && !orgToolsEnabled.value) {
      clearOrgMembershipCache()
      orgToolsEnabled.value = await checkOrgMembership()
    }
  },
)
</script>

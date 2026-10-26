<template>
  <div v-if="orgs.length > 0" class="relative" :class="block ? 'block w-full' : 'inline-block'">
    <button
      type="button"
      class="tap-scale flex min-h-11 items-center gap-2.5 rounded-xl border border-g-border bg-g-surface px-3 py-2 text-g-text transition-colors hover:border-g-primary/40"
      :class="block ? 'w-full' : 'max-w-[min(100%,14rem)]'"
      :title="activeOrg ? activeOrg.org_name : 'Select organization'"
      :aria-label="compact ? `Organization: ${activeOrg ? activeOrg.org_name : 'none selected'}` : undefined"
      :aria-expanded="isOpen ? 'true' : 'false'"
      data-cursor="nav"
      @click="isOpen = !isOpen"
    >
      <OrgLogo
        :logo-url="activeOrg?.logo_url"
        :name="activeOrg?.org_name ?? ''"
        size="sm"
      />
      <span
        class="min-w-0 flex-1 truncate text-left text-sm font-medium leading-tight"
        :class="compact ? 'hidden sm:inline' : ''"
      >
        {{ activeOrg ? activeOrg.org_name : 'Select org' }}
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-200"
        :class="isOpen ? 'rotate-180' : ''"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Below sm the menu is a bottom sheet teleported to body; from sm it is an anchored dropdown. -->
    <Teleport to="body" :disabled="!isMobile">
      <button
        v-if="isOpen"
        type="button"
        data-org-switcher-backdrop
        class="fixed inset-0 z-[10000] cursor-default border-0 bg-slate-900/30 p-0 sm:z-40 sm:bg-transparent"
        aria-label="Close organization menu"
        @click="isOpen = false"
      />

      <div
        v-if="isOpen"
        data-org-switcher-menu
        role="dialog"
        aria-label="Switch organization"
        class="fixed inset-x-0 bottom-0 z-[10001] max-h-[80dvh] overflow-y-auto rounded-t-3xl border border-g-border bg-g-surface px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-left shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:z-50 sm:max-h-none sm:w-72 sm:max-w-[calc(100vw-2rem)] sm:overflow-visible sm:rounded-xl sm:p-0 sm:py-1.5 sm:shadow-xl"
        :class="placement === 'up' ? 'sm:bottom-full sm:left-0 sm:mb-1.5' : 'sm:right-0 sm:mt-1.5'"
      >
        <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-g-border sm:hidden" aria-hidden="true" />
        <p class="px-3 pb-2 text-sm font-semibold text-g-muted sm:hidden">Switch organization</p>
        <div class="sm:max-h-56 sm:overflow-y-auto sm:py-1">
          <button
            v-for="org in orgs"
            :key="org.org_id"
            type="button"
            class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-g-bg sm:rounded-none"
            :class="activeOrg?.org_id === org.org_id ? 'bg-g-bg/80' : ''"
            data-cursor="nav"
            @click="handleSelect(org)"
          >
            <OrgLogo :logo-url="org.logo_url" :name="org.org_name" size="sm" />
            <span
              class="min-w-0 flex-1 truncate text-base leading-snug sm:text-sm"
              :class="activeOrg?.org_id === org.org_id ? 'font-semibold text-[#DEAC4B]' : 'text-g-text'"
            >
              {{ org.org_name }}
            </span>
            <span v-if="activeOrg?.org_id === org.org_id" class="text-xs font-bold text-[#DEAC4B]" aria-hidden="true">●</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import OrgLogo from '@/components/OrgLogo.vue'
import type { OrgListItem } from '@/types/orgs'

const props = withDefaults(
  defineProps<{
    /** Logo only below `sm` (top bar). */
    compact?: boolean
    /** Fill the parent width (side rail). */
    block?: boolean
    /** Open the menu above the trigger (side rail footer). */
    placement?: 'down' | 'up'
    /** Load orgs on mount. The app shell already loads them. */
    autoFetch?: boolean
  }>(),
  { compact: false, block: false, placement: 'down', autoFetch: true },
)

const { orgs, activeOrg, fetchOrgs, selectOrg } = useActiveOrg()
const isOpen = ref(false)
const isMobile = ref(false)
let mql: MediaQueryList | null = null

function syncMobile() {
  isMobile.value = mql?.matches ?? false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') isOpen.value = false
}

watch(isOpen, (open) => {
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

function handleSelect(org: OrgListItem) {
  isOpen.value = false
  selectOrg(org)
}

onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    mql = window.matchMedia('(max-width: 639px)')
    syncMobile()
    mql.addEventListener?.('change', syncMobile)
  }
  if (props.autoFetch) fetchOrgs()
})

onBeforeUnmount(() => {
  mql?.removeEventListener?.('change', syncMobile)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="orgs.length > 0"
    class="relative"
    :class="block ? 'block w-full' : 'inline-block'"
  >
    <button
      ref="triggerRef"
      type="button"
      class="flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-card py-2 text-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      :class="[block ? 'w-full' : 'max-w-[min(100%,14rem)]', collapsed ? 'justify-center px-0' : 'px-3']"
      :title="activeOrg ? activeOrg.org_name : 'Select organization'"
      :aria-label="`Organization: ${activeOrg ? activeOrg.org_name : 'none selected'}`"
      aria-haspopup="dialog"
      :aria-controls="isOpen ? menuId : undefined"
      :aria-expanded="isOpen ? 'true' : 'false'"
     
      @click="onTriggerClick"
    >
      <OrgLogo
        :logo-url="activeOrg?.logo_url"
        :logo-meta="activeOrg?.logoMeta"
        :name="activeOrg?.org_name ?? ''"
        size="sm"
      />
      <span
        data-org-label
        class="min-w-0 flex-1 truncate text-left font-mono text-sm font-semibold"
        :class="collapsed ? 'sr-only' : compact ? 'hidden sm:inline' : ''"
      >{{ activeOrg ? orgSlugLabel(activeOrg) : 'Select org' }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-200"
        :class="[isOpen ? 'rotate-180' : '', collapsed ? 'hidden' : '']"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Below sm the menu is a bottom sheet teleported to body; from sm it is an anchored dropdown. -->
    <BottomSheet
      :id="menuId"
      v-model:open="isOpen"
      title="Switch organization"
      close-label="Close organization menu"
      data-org-switcher-menu
      :class="[
        'absolute z-50 sm:w-72 max-w-[calc(100vw-2rem)]',
        placement === 'up' ? 'bottom-full left-0 mb-1.5' : 'right-0 mt-1.5',
      ]"
    >
      <div class="sm:max-h-56 sm:overflow-y-auto sm:py-1">
        <button
          v-for="org in orgs"
          :key="org.org_id"
          type="button"
          class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted sm:rounded-none"
          :title="org.org_name"
          :class="activeOrg?.org_id === org.org_id ? 'bg-muted/80' : ''"
          :aria-current="activeOrg?.org_id === org.org_id ? 'true' : undefined"
          @click="handleSelect(org)"
        >
          <OrgLogo
            :logo-url="org.logo_url"
            :logo-meta="org.logoMeta"
            :name="org.org_name"
            size="sm"
          />
          <span
            class="min-w-0 flex-1 truncate font-mono text-base leading-snug sm:text-sm"
            :class="activeOrg?.org_id === org.org_id ? 'font-semibold text-primary' : 'text-foreground'"
          >{{ orgSlugLabel(org) }}</span>
          <span
            v-if="activeOrg?.org_id === org.org_id"
            class="text-xs font-bold text-primary"
            aria-hidden="true"
          >●</span>
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, useId, onMounted } from 'vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import OrgLogo from '@/components/OrgLogo.vue'
import { orgSlugLabel, type OrgListItem } from '@/types/orgs'

const props = withDefaults(
  defineProps<{
    /** Logo only below `sm` (top bar). */
    compact?: boolean
    /** Fill the parent width (side rail). */
    block?: boolean
    /** Show the logo only (collapsed side rail). */
    collapsed?: boolean
    /** Open the menu above the trigger (side rail footer). */
    placement?: 'down' | 'up'
    /** Load orgs on mount. The app shell already loads them. */
    autoFetch?: boolean
  }>(),
  { compact: false, block: false, collapsed: false, placement: 'down', autoFetch: true },
)

const { orgs, activeOrg, fetchOrgs, selectOrg } = useActiveOrg()
const isOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuId = useId()

// Safari does not focus a button on click, so record the trigger as the opener before the sheet opens.
function onTriggerClick() {
  if (!isOpen.value) triggerRef.value?.focus()
  isOpen.value = !isOpen.value
}

watch(isOpen, (open) => {
  if (!open) void nextTick(() => triggerRef.value?.focus())
})

function handleSelect(org: OrgListItem) {
  isOpen.value = false
  selectOrg(org)
}

onMounted(() => {
  if (props.autoFetch) fetchOrgs()
})
</script>

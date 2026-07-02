<template>
  <div v-if="orgs.length > 0" class="relative inline-block font-mono text-[10px]">
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="isOpen = false" />

    <button
      type="button"
      class="tap-scale flex max-w-[min(100%,11rem)] items-center gap-2 rounded-lg border border-g-border bg-g-surface px-2.5 py-1.5 lowercase tracking-normal text-g-text transition-colors hover:border-g-primary/40"
      :title="activeOrg ? orgSlug(activeOrg) : 'Select organization'"
      data-cursor="nav"
      @click="isOpen = !isOpen"
    >
      <OrgLogo
        :logo-url="activeOrg?.logo_url"
        :name="activeOrg?.org_name ?? ''"
        size="xs"
      />
      <span class="truncate text-left text-[11px] leading-tight">
        {{ activeOrg ? orgSlug(activeOrg) : 'select-org' }}
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3 w-3 shrink-0 opacity-40 transition-transform duration-200"
        :class="isOpen ? 'rotate-180' : ''"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 z-50 mt-1.5 w-64 max-w-[min(90vw,16rem)] rounded-xl border border-g-border bg-g-surface py-1.5 text-left shadow-xl"
    >
      <div class="border-b border-g-border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-g-muted">
        Switch Organization
      </div>
      <div class="max-h-48 overflow-y-auto py-1">
        <button
          v-for="org in orgs"
          :key="org.org_id"
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-g-bg"
          :class="activeOrg?.org_id === org.org_id ? 'bg-g-bg/80' : ''"
          data-cursor="nav"
          @click="handleSelect(org)"
        >
          <OrgLogo :logo-url="org.logo_url" :name="org.org_name" size="xs" />
          <span
            class="min-w-0 flex-1 truncate font-mono text-[11px] lowercase leading-snug"
            :class="activeOrg?.org_id === org.org_id ? 'font-bold text-[#DEAC4B]' : 'text-g-text'"
          >
            {{ orgSlug(org) }}
          </span>
          <span v-if="activeOrg?.org_id === org.org_id" class="text-[9px] font-bold text-[#DEAC4B]">●</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import OrgLogo from '@/components/OrgLogo.vue'
import { orgSlug, type OrgListItem } from '@/types/orgs'

const { orgs, activeOrg, fetchOrgs, selectOrg } = useActiveOrg()
const isOpen = ref(false)

function handleSelect(org: OrgListItem) {
  isOpen.value = false
  selectOrg(org)
}

onMounted(() => {
  fetchOrgs()
})
</script>

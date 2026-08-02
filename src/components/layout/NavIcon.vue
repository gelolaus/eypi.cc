<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :class="cn('h-5 w-5 shrink-0', className)"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <!-- home -->
    <path
      v-if="name === 'home'"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M3 10.5 12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
    />
    <!-- links -->
    <path
      v-else-if="name === 'links'"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M13.828 10.172a4 4 0 00-5.656 0l-2 2a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l2-2a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
    <!-- orgs -->
    <path
      v-else-if="name === 'orgs'"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M17 20v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zm12 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
    />
    <!-- forms -->
    <path
      v-else-if="name === 'forms'"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z"
    />
    <!-- frames -->
    <path
      v-else-if="name === 'frames'"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 16h10"
    />
    <!-- tix -->
    <path
      v-else-if="name === 'tix'"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 00-2 2 2 2 0 002 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 002-2 2 2 0 00-2-2V7a2 2 0 012-2z"
    />
    <!-- orgTools (grid) -->
    <path
      v-else
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
</template>

<script setup lang="ts">
import { cn } from '@/lib/cn'
import type { AppNavItem } from '@/components/layout/app-nav'

defineProps<{
  name: AppNavItem['icon']
  className?: string
}>()
</script>

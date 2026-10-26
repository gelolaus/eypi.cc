<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="size-5 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.75"
    aria-hidden="true"
  >
    <path v-for="(d, index) in paths" :key="index" stroke-linecap="round" stroke-linejoin="round" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NavIconName } from '@/config/nav'

const props = defineProps<{ name: NavIconName | 'more' }>()

const ICONS: Record<NavIconName | 'more', string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9v11h5v-6h4v6h5V9'],
  link: [
    'M13.8 10.2a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.3-1.3',
    'M10.2 13.8a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1.3 1.3',
  ],
  ticket: ['M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5Z', 'M15 6v12'],
  frame: ['M4 4h16v16H4Z', 'M8 16a4 4 0 0 1 8 0', 'M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  form: ['M7 3h7l5 5v13H7Z', 'M14 3v5h5', 'M10 13h6', 'M10 17h6'],
  orgs: ['M3 21h18', 'M5 21V8l7-4 7 4v13', 'M9 21v-5h6v5', 'M9 11h.01', 'M15 11h.01'],
  invites: ['M3 6h18v12H3Z', 'm3 7 9 6 9-6'],
  account: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0'],
  admin: ['M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z', 'm9 12 2 2 4-4'],
  login: ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'M10 17l5-5-5-5', 'M15 12H3'],
  signup: ['M16 21a6 6 0 0 0-12 0', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M19 8v6', 'M22 11h-6'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
}

const paths = computed(() => ICONS[props.name])
</script>

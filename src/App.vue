<template>
  <a
    href="#app-content"
    class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
  >Skip to content</a>

  <!-- Page transition overlay -->
  <AppTransition ref="appTransitionRef" />

  <AppShell>
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </AppShell>

  <ToastContainer />
  <DialogHost />
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import DialogHost from '@/components/DialogHost.vue'
import AppTransition from '@/components/AppTransition.vue'

const appTransitionRef = ref<InstanceType<typeof AppTransition> | null>(null)

provide('appTransition', appTransitionRef)
</script>

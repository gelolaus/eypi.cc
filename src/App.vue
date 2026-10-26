<template>
  <a href="#app-content" class="skip-link">Skip to content</a>

  <!-- Page transition overlay -->
  <AppTransition ref="appTransitionRef" />

  <!-- Background layer: dot grid -->
  <div
    id="base-layer"
    class="fixed inset-0 pointer-events-none legacy-dot-grid"
    style="z-index: -10;"
  />

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
import AppShell from '@/components/AppShell.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import DialogHost from '@/components/DialogHost.vue'
import AppTransition from '@/components/AppTransition.vue'

const appTransitionRef = ref<InstanceType<typeof AppTransition> | null>(null)

provide('appTransition', appTransitionRef)
</script>

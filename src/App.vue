<template>
  <a
    href="#app-content"
    class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
  >Skip to content</a>

  <!-- Page transition overlay -->
  <AppTransition ref="appTransitionRef" />

  <component :is="Shell">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </component>

  <ToastContainer />
  <DialogHost />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, provide } from 'vue'
import { useRoute } from 'vue-router'
import PublicShell from '@/components/layout/PublicShell.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import DialogHost from '@/components/DialogHost.vue'
import AppTransition from '@/components/AppTransition.vue'

// The signed-in shell is only fetched on app pages. Public pages never pay for it.
const AppShell = defineAsyncComponent(() => import('@/components/layout/AppShell.vue'))
const route = useRoute()
const Shell = computed(() => (route.meta.layout === 'public' ? PublicShell : AppShell))

const appTransitionRef = ref<InstanceType<typeof AppTransition> | null>(null)

provide('appTransition', appTransitionRef)
</script>

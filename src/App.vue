<template>
  <div :class="['flex min-h-screen flex-col', IS_LOCAL_DEV ? 'local-dev' : '']">
    <LocalDevBanner />

    <!-- Initial page load animation -->
    <AppLoader />

    <!-- Page transition overlay -->
    <AppTransition ref="appTransitionRef" />

    <!-- Custom cursor overlay -->
    <AppCursor />

    <!-- Confetti canvas -->
    <ParticleCanvas />

    <!-- Back to top -->
    <ScrollTop />

    <!-- Background layer: dot grid -->
    <div
      id="base-layer"
      class="fixed inset-0 pointer-events-none bg-dot-grid"
      style="z-index: -10;"
    />

    <TheHeader />

    <!-- pt-20 compensates for the fixed pill nav height; extra top padding when local dev banner is shown -->
    <main
      id="app-content"
      :class="[
        'relative z-10 flex min-h-0 flex-1 flex-col',
        IS_LOCAL_DEV ? 'pt-[calc(5rem+1.75rem)]' : 'pt-20',
      ]"
    >
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <TheFooter />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import TheHeader from '@/components/TheHeader.vue'
import TheFooter from '@/components/TheFooter.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import AppCursor from '@/components/AppCursor.vue'
import ParticleCanvas from '@/components/ParticleCanvas.vue'
import ScrollTop from '@/components/ScrollTop.vue'
import AppLoader from '@/components/AppLoader.vue'
import AppTransition from '@/components/AppTransition.vue'
import LocalDevBanner from '@/components/LocalDevBanner.vue'
import { IS_LOCAL_DEV } from '@/config/api'
import { useKeyboardNav } from '@/composables/useKeyboardNav'

const appTransitionRef = ref<InstanceType<typeof AppTransition> | null>(null)

provide('appTransition', appTransitionRef)
useKeyboardNav()
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <!-- Base layer: grid + coordinates (behind everything) -->
    <div
      id="base-layer"
      class="fixed inset-0 pointer-events-none bg-dot-grid"
      style="z-index: -10;"
    >
      <!-- Corner registration marks -->
      <div class="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-gray-300" />
      <div class="absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-gray-300" />
      <div class="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-gray-300" />
      <div class="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-gray-300" />
      <!-- Pasay coordinates -->
      <div
        class="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-xs text-gray-400"
      >
        COORD. 14.531105 N // 121.021309 E
      </div>
    </div>

    <TheHeader />
    <main id="app-content" class="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <router-view v-slot="{ Component }">
        <transition name="wave-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <TheFooter />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import TheHeader from '@/components/TheHeader.vue'
import TheFooter from '@/components/TheFooter.vue'
import ToastContainer from '@/components/ToastContainer.vue'
</script>

<style>
/* Unscoped: transition classes are applied to child route components */

/* 1. ROUTE COMPONENT STACKING
   Absolutely position both pages so they overlap inside <main>
   instead of pushing each other down during the 0.5s transition. */
.wave-slide-leave-active,
.wave-slide-enter-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  /* A benign animation just to keep Vue's timing engine synced */
  animation: keepAlive 0.8s forwards;
}

@keyframes keepAlive {
  0%,
  100% {
    visibility: visible;
  }
}

/* 2. ZERO-LAG FULL-SCREEN SHUTTER
   Because the parent no longer has a 'transform', this position: fixed
   element will now successfully anchor to the absolute browser window,
   covering the Navbar and Footer. */
.wave-slide-leave-active::after,
.wave-slide-enter-active::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 300vw;
  height: 100vh;
  z-index: 99999 !important; /* Maximum priority */
  pointer-events: none;
  will-change: transform;
  background: linear-gradient(
    to right,
    transparent 0vw,
    transparent 50vw,
    #f8f9fa 50vw,
    #f8f9fa 65vw, /* Silver Band */
    #deac4b 65vw,
    #deac4b 80vw, /* Gold Band */
    #34418f 80vw,
    #34418f 180vw, /* Massive Blue Block */
    transparent 180vw,
    transparent 300vw
  );
}

/* 3. CONTINUOUS VELOCITY PHYSICS */
.wave-slide-leave-active::after {
  animation: sweepIn 0.8s cubic-bezier(0.5, 0, 1, 1) forwards;
}

.wave-slide-enter-active::after {
  animation: sweepOut 0.8s cubic-bezier(0, 0, 0.2, 1) forwards;
}

@keyframes sweepIn {
  0% {
    transform: translate3d(-260vw, 0, 0);
  }
  100% {
    transform: translate3d(-80vw, 0, 0);
  }
}

@keyframes sweepOut {
  0% {
    transform: translate3d(-80vw, 0, 0);
  }
  100% {
    transform: translate3d(100vw, 0, 0);
  }
}
</style>

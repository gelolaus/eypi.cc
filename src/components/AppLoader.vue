<template>
  <Transition name="loader">
    <div v-if="isVisible" class="app-loader" aria-hidden="true">
      <span class="app-loader__text">eypi<span class="app-loader__dot">.</span>cc</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isVisible = ref(true)

onMounted(() => {
  setTimeout(() => {
    isVisible.value = false
  }, 1400)
})
</script>

<style scoped>
.app-loader {
  position: fixed;
  inset: 0;
  z-index: 99998;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
  pointer-events: none;
}

.app-loader__text {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.04em;
  animation: loader-scale-in 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.app-loader__dot {
  color: var(--color-accent);
}

@keyframes loader-scale-in {
  0% {
    opacity: 0;
    transform: scale(0.6);
    letter-spacing: 0.1em;
  }
  40% {
    opacity: 1;
    transform: scale(1);
    letter-spacing: -0.04em;
  }
  80% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
  }
}

.loader-leave-active {
  transition: opacity 0.25s ease;
}

.loader-leave-to {
  opacity: 0;
}
</style>

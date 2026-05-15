<template>
  <div
    v-if="isActive"
    class="app-transition"
    :class="{ 'app-transition--expanding': isExpanding }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isActive = ref(false)
const isExpanding = ref(false)

function trigger(): Promise<void> {
  return new Promise((resolve) => {
    isActive.value = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isExpanding.value = true
        setTimeout(() => {
          resolve()
          setTimeout(() => {
            isActive.value = false
            isExpanding.value = false
          }, 400)
        }, 500)
      })
    })
  })
}

defineExpose({ trigger })
</script>

<style scoped>
.app-transition {
  position: fixed;
  inset: 0;
  z-index: 99997;
  background-color: var(--color-primary);
  clip-path: circle(0% at 50% 50%);
  pointer-events: none;
}

.app-transition--expanding {
  clip-path: circle(150% at 50% 50%);
  transition: clip-path 0.6s cubic-bezier(0.76, 0, 0.24, 1);
}
</style>

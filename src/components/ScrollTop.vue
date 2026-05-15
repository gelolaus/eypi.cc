<template>
  <Transition name="scroll-top">
    <button
      v-if="isVisible"
      class="scroll-top-btn"
      aria-label="Back to top"
      data-cursor="nav"
      @click="scrollToTop"
    >
      ↑
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isVisible = ref(false)

function onScroll() {
  isVisible.value = window.scrollY > 300
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.scroll-top-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9998;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.scroll-top-btn:hover {
  border-color: var(--color-accent);
  background-color: var(--color-accent);
  color: #fff;
  transform: translateY(-2px);
}

.scroll-top-enter-active,
.scroll-top-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.scroll-top-enter-from,
.scroll-top-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.85);
}
</style>

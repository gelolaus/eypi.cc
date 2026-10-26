<template>
  <Transition name="scroll-top">
    <button
      v-if="isVisible"
      type="button"
      class="scroll-top-btn"
      :class="withTabBar ? 'scroll-top-btn--tabbar' : ''"
      aria-label="Back to top"
     
      @click="toTop"
    >
      ↑
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useScrollContainer } from '@/composables/useScrollContainer'

withDefaults(defineProps<{ withTabBar?: boolean }>(), { withTabBar: false })

const { container, scrollTop, scrollToTop } = useScrollContainer()
const isVisible = ref(false)
let target: HTMLElement | Window | null = null

function onScroll() {
  isVisible.value = scrollTop() > 300
}

function bind() {
  target?.removeEventListener('scroll', onScroll)
  target = container.value ?? window
  target.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

function toTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scrollToTop(reduce ? 'auto' : 'smooth')
}

onMounted(bind)
watch(container, bind)
onUnmounted(() => {
  target?.removeEventListener('scroll', onScroll)
  target = null
})
</script>

<style scoped>
.scroll-top-btn {
  position: fixed;
  bottom: calc(1.5rem + env(safe-area-inset-bottom));
  right: 1rem;
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

/* Sits above the 4.5rem bottom tab bar and the home-indicator inset. */
.scroll-top-btn--tabbar {
  bottom: calc(4.5rem + 1rem + env(safe-area-inset-bottom));
}

@media (min-width: 640px) {
  .scroll-top-btn {
    right: 2rem;
    bottom: calc(2rem + env(safe-area-inset-bottom));
  }

  .scroll-top-btn--tabbar {
    bottom: calc(4.5rem + 1rem + env(safe-area-inset-bottom));
  }
}

@media (min-width: 1024px) {
  .scroll-top-btn--tabbar {
    bottom: 2rem;
  }
}

@media (hover: hover) and (pointer: fine) {
  .scroll-top-btn:hover {
    border-color: var(--color-accent);
    background-color: var(--color-accent);
    color: #1a1a2e;
    transform: translateY(-2px);
  }
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

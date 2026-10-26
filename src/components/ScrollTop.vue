<template>
  <Transition name="scroll-top">
    <button
      v-if="isVisible"
      type="button"
      class="fixed right-4 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-card text-lg text-foreground shadow-md backdrop-blur-md outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:right-8"
      :class="withTabBar
        ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-8'
        : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(2rem+env(safe-area-inset-bottom))]'"
      aria-label="Back to top"
      @click="toTop"
    >
      <span aria-hidden="true">↑</span>
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
.scroll-top-enter-active,
.scroll-top-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.scroll-top-enter-from,
.scroll-top-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.85);
}

@media (prefers-reduced-motion: reduce) {
  .scroll-top-enter-active,
  .scroll-top-leave-active {
    transition: none;
  }
}
</style>

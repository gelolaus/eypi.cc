<template>
  <Teleport to="body">
    <Transition name="org-sheet-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="$emit('close')"
      />
    </Transition>

    <Transition name="org-sheet-panel">
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-[91] rounded-t-2xl border border-g-border bg-g-surface pb-[env(safe-area-inset-bottom)] shadow-2xl lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-tools-sheet-title"
      >
        <div class="flex items-center justify-between border-b border-g-border px-4 py-3">
          <h2 id="org-tools-sheet-title" class="font-display text-base font-semibold text-g-text">
            Org tools
          </h2>
          <button
            type="button"
            class="rounded-full px-2 py-1 text-lg text-g-muted hover:text-g-text"
            aria-label="Close org tools"
            @click="$emit('close')"
          >
            &times;
          </button>
        </div>

        <nav class="grid gap-1 p-3" aria-label="Organization tools">
          <router-link
            v-for="item in items"
            :key="item.id"
            :to="item.href"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-g-muted transition hover:bg-g-bg hover:text-g-text"
            @click="$emit('close')"
          >
            <NavIcon :name="item.icon" class-name="text-g-primary" />
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import NavIcon from '@/components/layout/NavIcon.vue'
import type { AppNavItem } from '@/components/layout/app-nav'

defineProps<{
  open: boolean
  items: AppNavItem[]
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
.org-sheet-fade-enter-active,
.org-sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}
.org-sheet-fade-enter-from,
.org-sheet-fade-leave-to {
  opacity: 0;
}

.org-sheet-panel-enter-active,
.org-sheet-panel-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.org-sheet-panel-enter-from,
.org-sheet-panel-leave-to {
  transform: translateY(100%);
}
</style>

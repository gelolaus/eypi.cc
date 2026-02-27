<template>
  <div class="relative flex items-center justify-center p-8">
    <!-- Hardware module: metallic frame -->
    <div
      class="relative w-full max-w-md rounded-3xl border-2 border-gray-300 bg-gray-100/50 shadow-[inset_0_2px_20px_rgba(0,0,0,0.06)]"
    >
      <!-- Glass back with Mica blur -->
      <div
        class="absolute inset-3 rounded-2xl bg-white/40 shadow-[inset_0_4px_24px_rgba(31,38,135,0.08)] backdrop-blur-md"
      >
        <!-- Screw accents - corners -->
        <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-500" />
        <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-500" />
        <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-500" />
        <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-500" />

        <!-- Recording indicator -->
        <div class="absolute right-4 top-4 flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span class="font-mono text-[10px] text-gray-500">REC</span>
        </div>

        <!-- Pill-shaped cutout with link display -->
        <div class="flex flex-1 items-center justify-center p-12 pt-14">
          <div
            class="flex items-center justify-center rounded-full border-2 border-gray-300 bg-white/60 px-8 py-4 shadow-inner"
          >
            <span class="font-mono text-base font-semibold text-apc-blue sm:text-lg">
              eypi.cc/{{ slug || 'your-slug' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  slug?: string
}>()
</script>

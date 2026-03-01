<template>
  <div
    class="fixed inset-0 z-[9999] flex w-full flex-col items-center justify-center overflow-hidden bg-[#E5E5E5] p-6"
  >
    <div
      class="absolute left-0 top-0 h-1 w-full bg-[#34418F]/20 shadow-[0_0_15px_#34418F] animate-scan"
    />

    <div class="flex flex-col items-center text-center">
      <div
        class="relative mb-8 flex h-16 w-16 items-center justify-center border-2 border-[#34418F] animate-pulse"
      >
        <div class="absolute left-1 top-1 h-2 w-2 bg-[#34418F]" />
        <div class="absolute bottom-1 right-1 h-2 w-2 bg-[#34418F]" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 text-[#34418F]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>

      <h1
        class="mb-4 font-mono text-xl font-black uppercase tracking-[0.2em] text-[#34418F] md:text-2xl"
      >
        Resolving Transmission
      </h1>
      <p
        class="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-gray-500"
      >
        Target:
        <span class="rounded bg-gray-200 px-2 py-0.5 font-bold text-gray-900">
          /{{ currentSlug }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const currentSlug = ref((route.params.slug as string) ?? '')

onMounted(async () => {
  try {
    const response = await fetch(`http://localhost:8787/api/links/${currentSlug.value}`)
    const data = await response.json()

    if (response.ok && data.original_url) {
      window.location.replace(data.original_url)
    } else {
      router.replace({
        name: 'not-found',
        params: { pathMatch: [currentSlug.value] },
      })
    }
  } catch {
    router.replace({
      name: 'not-found',
      params: { pathMatch: [currentSlug.value] },
    })
  }
})
</script>

<style scoped>
@keyframes scan {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(100vh);
  }
}

.animate-scan {
  animation: scan 2s ease-in-out infinite;
}
</style>

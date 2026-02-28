<template>
  <header
    class="sticky top-0 z-50 shrink-0 w-full border-b border-apc-blue/10 bg-[#f5f5f4]/80 backdrop-blur-md"
  >
    <nav
      class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      aria-label="Main navigation"
    >
      <router-link
        to="/"
        class="font-mono text-lg font-semibold text-apc-blue transition-colors hover:text-apc-gold"
      >
        eypi.cc
      </router-link>
      <div class="flex items-center gap-3">
        <template v-if="route.path === '/dashboard'">
          <span class="font-mono text-sm font-bold text-[#34418F]">angelo@eypi.cc</span>
          <a
            href="#"
            class="font-mono text-sm text-gray-500 transition-colors hover:text-gray-700"
            @click.prevent
          >
            Logout
          </a>
        </template>
        <router-link
          v-else
          to="/login"
          class="rounded-lg bg-apc-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 hover:shadow-md"
        >
          Login
        </router-link>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

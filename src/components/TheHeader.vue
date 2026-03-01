<template>
  <header
    class="sticky top-0 z-50 shrink-0 w-full border-b border-apc-blue/10 bg-[#f5f5f4]/80 backdrop-blur-md"
  >
    <nav
      class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      aria-label="Main navigation"
    >
      <router-link
        :to="route.path === '/dashboard' || route.path === '/settings' ? '/dashboard' : '/'"
        class="font-mono text-lg font-semibold text-apc-blue transition-colors hover:text-apc-gold"
      >
        eypi.cc
      </router-link>
      <div class="flex items-center gap-3">
        <div v-if="route.path === '/dashboard' || route.path === '/settings'" class="relative">
          <div v-if="isMenuOpen" @click="isMenuOpen = false" class="fixed inset-0 z-40"></div>
          <button @click="isMenuOpen = !isMenuOpen" class="flex items-center gap-2 font-mono text-sm font-bold text-[#34418F] bg-transparent border-2 border-transparent hover:border-gray-200 hover:bg-white py-1.5 px-3 rounded-lg transition-all relative z-50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Angelo Laus</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200 text-gray-400" :class="isMenuOpen ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div v-if="isMenuOpen" class="absolute right-0 mt-4 w-56 bg-white border-2 border-gray-200 shadow-2xl z-50 flex flex-col font-mono">
            <div class="px-5 py-4 border-b-2 border-gray-100 bg-gray-50">
              <div class="text-sm font-black text-[#34418F] uppercase tracking-wider">Angelo Laus</div>
              <div class="text-xs text-gray-500 mt-1">angelo@eypi.cc</div>
            </div>
            <div class="py-2">
              <router-link to="/settings" @click="isMenuOpen = false" class="px-5 py-3 text-xs font-bold text-gray-600 hover:text-[#34418F] hover:bg-gray-50 uppercase tracking-wider transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Account Settings
              </router-link>
              <a href="#" @click.prevent="handleLogout" class="px-5 py-3 text-xs font-bold text-red-600 hover:bg-red-50 uppercase tracking-wider transition-colors flex items-center gap-3 border-t border-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </a>
            </div>
          </div>
        </div>
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
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const isMenuOpen = ref(false)

const handleLogout = () => {
  localStorage.removeItem('eypi_token')
  isMenuOpen.value = false
  toast.success('Session terminated safely.')
  router.push('/login')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <LocalDevBanner />
    <header
      class="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6"
    >
      <BrandLogo
        :to="signedIn ? '/dashboard' : '/'"
        class="min-h-11"
      />

      <!-- Fixed size so the header does not shift or flash Sign in for a
           signed-in visitor while /api/me is still in flight. -->
      <span
        v-if="!resolved"
        data-header-account-placeholder
        class="h-11 w-24 rounded-xl bg-muted/60"
        aria-hidden="true"
      />
      <div
        v-else
        class="flex items-center gap-1"
      >
        <router-link
          :to="{ name: 'org-catalog' }"
          class="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:flex"
        >
          Orgs
        </router-link>
        <Button
          v-if="signedIn"
          as-child
          class="h-11 px-4 font-semibold"
        >
          <router-link to="/dashboard">
            Dashboard
          </router-link>
        </Button>
        <Button
          v-else
          as-child
          class="h-11 px-4 font-semibold"
        >
          <router-link to="/login">
            Sign in
          </router-link>
        </Button>
      </div>
    </header>

    <main
      id="app-content"
      class="relative z-10 flex min-h-0 flex-1 flex-col"
    >
      <slot />
    </main>
    <MarketingFooter />
  </div>
  <ScrollTop />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import LocalDevBanner from '@/components/LocalDevBanner.vue'
import ScrollTop from '@/components/ScrollTop.vue'
import MarketingFooter from '@/components/marketing/MarketingFooter.vue'
import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/session'

const session = useSession()
const resolved = computed(() => session.status.value === 'ready' || session.settled.value)
const signedIn = computed(() => session.user.value !== null)
</script>

<template>
  <footer id="footer" class="relative overflow-hidden border-t border-border bg-background">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 sm:px-6">
      <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">Build with eypi.cc</h2>

      <nav class="flex flex-col divide-y divide-border border-y border-border" aria-label="Footer navigation">
        <template v-for="link in links" :key="link.label">
          <a
            v-if="link.external"
            :href="link.to"
            target="_blank"
            rel="noopener noreferrer"
            class="flex min-h-11 items-center justify-between gap-4 py-3 text-base font-medium text-muted-foreground transition hover:text-foreground"
          >
            <span>{{ link.label }}</span>
            <span data-footer-arrow aria-hidden="true">↗</span>
          </a>
          <router-link
            v-else
            :to="link.to"
            class="flex min-h-11 items-center justify-between gap-4 py-3 text-base font-medium text-muted-foreground transition hover:text-foreground"
          >
            <span>{{ link.label }}</span>
            <span data-footer-arrow aria-hidden="true">↗</span>
          </router-link>
        </template>
      </nav>

      <p class="text-base text-muted-foreground">© {{ currentYear }} eypi.cc. Built by Angelo Laus.</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()

const links = [
  { to: '/contact', label: 'Contact', external: false },
  { to: '/privacy', label: 'Privacy', external: false },
  { to: '/terms', label: 'Terms', external: false },
  { to: '/acceptable-use', label: 'Acceptable use', external: false },
  { to: 'https://gelolaus.com', label: 'Creator: gelolaus.com', external: true },
]
</script>

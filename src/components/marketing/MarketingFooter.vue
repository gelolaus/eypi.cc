<template>
  <footer
    id="footer"
    class="border-t border-border bg-background"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 py-4 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
      <p>© {{ currentYear }} Eypi. Built by Angelo Laus.</p>

      <nav
        class="flex flex-wrap items-center gap-x-4"
        aria-label="Footer navigation"
      >
        <template
          v-for="link in links"
          :key="link.label"
        >
          <a
            v-if="link.external"
            :href="link.to"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center transition hover:text-foreground"
          >{{ link.label }}</a>
          <router-link
            v-else
            :to="link.to"
            class="inline-flex min-h-11 items-center transition hover:text-foreground"
          >
            {{ link.label }}
          </router-link>
        </template>
      </nav>
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

<template>
  <section class="relative isolate overflow-hidden px-5 pb-24 pt-12 sm:px-6 sm:pt-20">
    <div class="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden="true" />
    <div
      class="float-slow pointer-events-none absolute -left-10 top-24 -z-10 size-40 rounded-3xl bg-primary/15"
      aria-hidden="true"
    />
    <div
      class="float-slow pointer-events-none absolute -right-8 bottom-16 -z-10 size-28 rounded-full bg-primary/10"
      aria-hidden="true"
    />

    <div class="mx-auto grid max-w-5xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
      <div class="text-center lg:text-left">
        <BrandLogo size="lg" class="justify-center lg:justify-start" />
        <h1 class="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
          The toolkit for <span class="text-primary">APC</span> orgs.
        </h1>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0">
          Short links, official paperwork, event tickets, and org pages. One APC login, zero ads.
        </p>
        <div class="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
          <Button as-child size="lg" class="h-14 px-6 text-base">
            <router-link to="/login">Get started</router-link>
          </Button>
          <a
            href="#features"
            class="inline-flex min-h-11 items-center px-2 text-base font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            @click.prevent="scrollToFeatures"
          >
            See what's inside
          </a>
        </div>
      </div>

      <div data-hero-panel class="float-slow mx-auto w-full max-w-sm justify-self-center lg:justify-self-end" aria-hidden="true">
        <Card class="gap-3 p-5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground">Short links</span>
            <Badge>Live</Badge>
          </div>
          <div
            v-for="row in rows"
            :key="row.slug"
            class="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-base font-medium">eypi.cc/{{ row.slug }}</p>
              <p class="truncate text-sm text-muted-foreground">{{ row.host }}</p>
            </div>
            <Copy class="size-4 shrink-0 text-muted-foreground" />
          </div>
        </Card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { Copy } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const rows = [
  { slug: 'orgweek', host: 'docs.example.com' },
  { slug: 'join', host: 'forms.example.com' },
  { slug: 'tickets', host: 'events.example.com' },
]

function scrollToFeatures() {
  const target = document.getElementById('features')
  if (!target) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}
</script>

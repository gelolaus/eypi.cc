<template>
  <section id="features" class="mx-auto w-full max-w-5xl px-5 py-24 sm:px-6" aria-labelledby="features-heading">
    <h2 id="features-heading" class="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
      One login. Five tools your org already needs.
    </h2>

    <ul class="mt-10 grid grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-y-0 lg:divide-x">
      <li v-for="tool in tools" :key="tool.name" class="flex flex-col gap-3 py-6 sm:p-5">
        <h3 class="text-xl font-semibold tracking-tight">{{ tool.name }}</h3>
        <p class="text-base leading-relaxed text-muted-foreground">{{ tool.description }}</p>
        <router-link
          :to="tool.to"
          class="mt-auto inline-flex min-h-11 items-center gap-1 text-base font-medium text-primary underline-offset-4 hover:underline"
        >
          {{ tool.cta }}
          <span aria-hidden="true">→</span>
        </router-link>
      </li>
    </ul>

    <dl class="mt-14 grid gap-8 md:grid-cols-3">
      <div v-for="pillar in pillars" :key="pillar.title">
        <dt class="text-lg font-semibold tracking-tight">{{ pillar.title }}</dt>
        <dd class="mt-2 text-base leading-relaxed text-muted-foreground">{{ pillar.body }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
const tools = [
  {
    name: 'Links',
    description: 'Turn long URLs into branded eypi.cc short links with QR codes and click analytics.',
    to: '/login',
    cta: 'Shorten a link',
  },
  {
    name: 'Forms',
    description: 'Fill in event and org details once, then generate official APC paperwork.',
    to: '/login',
    cta: 'Generate paperwork',
  },
  {
    name: 'Tix',
    description: 'Run org events with QR tickets, guest lists, and camera-based check-in.',
    to: '/login',
    cta: 'Set up an event',
  },
  {
    name: 'Frames',
    description: 'Upload org frame overlays and let anyone create a matching profile picture.',
    to: '/login',
    cta: 'Launch a frame',
  },
  {
    name: 'Orgs',
    description: 'A public directory of APC student organizations with profile pages.',
    to: '/orgs',
    cta: 'Browse orgs',
  },
]

const pillars = [
  {
    title: 'Free, no catch',
    body: 'Built and run by one APC student developer. No ads, no premium tier, no funding round to please.',
  },
  {
    title: 'One login, every tool',
    body: 'Your APC account and org membership carry across Links, Forms, Tix, Frames, and Orgs. No separate signups.',
  },
  {
    title: "Shaped like APC's paperwork",
    body: 'Concessionaire contracts, visitor passes, and letters of intent match the formats APC already asks for.',
  },
]
</script>

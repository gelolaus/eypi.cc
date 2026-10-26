<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center px-5 py-12 md:px-6 md:py-24"
  >
    <div class="mx-auto flex w-full max-w-3xl flex-col items-center justify-center text-center">
      <h1 class="hero-title mb-5">
        The toolkit for <span class="text-[#DEAC4B]">APC</span> orgs.
      </h1>
      <p
        class="reveal delay-1 mb-8 max-w-xl text-base leading-relaxed text-g-muted md:text-xl"
      >
        Short links, official paperwork, event tickets, and org pages. One APC login, zero ads.
      </p>

      <div class="reveal delay-2 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        <router-link
          to="/login"
          class="btn-gold tap-scale inline-flex h-12 w-full items-center justify-center rounded-full px-8 text-base font-bold uppercase tracking-wide shadow-md transition-all hover:opacity-90 sm:h-14 sm:w-auto"
         
        >
          Get started
        </router-link>
        <a
          href="#features"
          class="inline-flex min-h-11 items-center justify-center px-4 text-base font-semibold text-[#34418F] underline-offset-4 hover:underline dark:text-g-text"
         
          @click.prevent="scrollToFeatures"
        >
          See what's inside
        </a>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
function scrollToFeatures() {
  const target = document.getElementById('features')
  if (!target) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}
</script>

<style scoped>
.hero-title {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: clamp(2.25rem, 9vw, 5rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: var(--color-primary);
}

html.dark .hero-title {
  color: var(--color-text);
}
</style>

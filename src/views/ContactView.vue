<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <Card className="relative w-full max-w-3xl">
      <div class="mb-10 border-b border-g-border pb-8">
        <h1 class="font-display text-3xl font-bold tracking-tight text-g-text">
          Contact
        </h1>
        <p class="mt-2 text-xs text-g-muted">
          Last Updated: May 16, 2026
        </p>
      </div>

      <div class="space-y-10 text-sm leading-relaxed">
        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            General Support
          </h3>
          <p class="text-g-muted mb-3">
            For inquiries and bug reports:
          </p>
          <a
            href="mailto:hello@gelolaus.com"
            class="font-semibold text-g-brand underline underline-offset-4 transition-colors hover:text-g-primary"
          >
            hello@gelolaus.com
          </a>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            Build with Eypi
          </h3>
          <p class="text-g-muted mb-4">
            APC students, org officers, and faculty — if you have an idea for the college community, send an email <strong class="text-g-text">from your APC-provided email address</strong> with the subject line <strong class="text-g-text">"Build with Eypi"</strong>.
          </p>
          <a
            href="mailto:hello@gelolaus.com?subject=Build%20with%20Eypi"
            class="font-semibold text-g-brand underline underline-offset-4 transition-colors hover:text-g-primary"
          >
            hello@gelolaus.com
          </a>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            What to Include
          </h3>
          <ul class="list-disc pl-5 space-y-2 text-g-muted">
            <li>Your organization, school, department, or role</li>
            <li>A brief description of the project or feature idea</li>
            <li>How it would serve the APC community</li>
          </ul>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
</script>

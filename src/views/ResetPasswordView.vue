<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_70%)]"
    />

    <Card className="relative w-full max-w-md">
      <h1 class="mb-4 font-display text-2xl font-bold tracking-tight text-g-text">
        Reset password
      </h1>
      <p class="mb-6 text-sm leading-relaxed text-g-muted">
        Self-service password reset is coming soon.
      </p>

      <div class="mb-8 space-y-4 text-sm leading-relaxed text-g-muted">
        <p>
          If you are already signed in, you can update your password from
          <router-link
            to="/settings"
            class="text-g-brand underline transition-colors hover:text-g-primary"
          >
            Settings
          </router-link>.
        </p>
        <p>
          For account access issues, contact the admin via the
          <router-link
            to="/contact"
            class="text-g-brand underline transition-colors hover:text-g-primary"
          >
            Contact
          </router-link>
          page.
        </p>
      </div>

      <Button variant="secondary" className="w-full" @click="goLogin">
        Back to login
      </Button>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()

function goLogin() {
  router.push('/login')
}
</script>

<template>
  <section class="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:py-24">
    <Card class="w-full max-w-md gap-6 rounded-3xl bg-card/80 p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.65)] sm:p-8">
      <div class="space-y-3 text-center">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock
            class="size-7"
            aria-hidden="true"
          />
        </div>
        <h1 class="font-display text-3xl font-semibold tracking-tight">
          This link is password protected
        </h1>
        <p class="font-mono text-sm text-muted-foreground">
          {{ slug }}
        </p>
      </div>

      <form
        class="flex flex-col gap-2"
        @submit.prevent="onSubmit"
      >
        <Label for="unlock-password">
          Password
        </Label>
        <Input
          id="unlock-password"
          v-model="password"
          type="password"
          name="password"
          autocomplete="current-password"
          class="font-mono"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'password-error' : undefined"
        />
        <p
          v-if="error"
          id="password-error"
          role="alert"
          class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive"
        >
          {{ error }}
        </p>
        <Button
          type="submit"
          size="lg"
          class="mt-4 w-full"
          :disabled="pending"
        >
          Continue
        </Button>
      </form>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Lock } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL } from '@/config/api'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
const password = ref('')
const error = ref('')
const pending = ref(false)

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/links/${encodeURIComponent(slug.value)}/unlock${route.query.src === 'qr' ? '?src=qr' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: password.value }),
    })
    const data = await res.json() as {
      url?: string
      error?: { message?: string; fields?: { password?: string } }
    }
    if (!res.ok || typeof data.url !== 'string' || !data.url) {
      error.value = data.error?.fields?.password || data.error?.message || 'That password is wrong.'
      return
    }
    location.replace(data.url)
  } catch {
    error.value = 'Could not check that password. Try again.'
  } finally {
    pending.value = false
  }
}
</script>

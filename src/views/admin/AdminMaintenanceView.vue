<template>
  <section aria-labelledby="maintenance-heading">
    <h2
      id="maintenance-heading"
      class="font-heading text-xl font-semibold tracking-tight"
    >
      Image optimizer
    </h2>
    <p class="mt-2 max-w-prose text-sm text-muted-foreground">
      Older logos, banners and frames were saved before right-sized copies existed. This makes
      them in your browser, one at a time, so pages load faster. Keep this tab open while it runs.
    </p>

    <p
      v-if="loadError"
      role="alert"
      class="mt-4 text-sm text-destructive"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="loading"
      class="mt-4 text-sm text-muted-foreground"
    >
      Checking for images to optimize…
    </p>
    <p
      v-else-if="total === 0"
      class="mt-4 rounded-2xl border border-border px-5 py-8 text-center text-sm text-muted-foreground"
    >
      Every stored image is already optimized.
    </p>

    <div
      v-else
      class="mt-4 flex flex-col gap-3"
    >
      <p
        data-testid="progress"
        class="text-sm font-medium"
        role="status"
        aria-live="polite"
      >
        <template v-if="!started">
          {{ total }} {{ total === 1 ? 'image' : 'images' }} to optimize
        </template>
        <template v-else-if="running">
          {{ Math.min(done + 1, total) }} of {{ total }}
        </template>
        <template v-else>
          {{ summary }}
        </template>
      </p>
      <p
        v-if="waiting"
        class="text-sm text-muted-foreground"
      >
        Waiting a moment to stay within the upload limit…
      </p>
      <div>
        <Button
          :disabled="running"
          @click="start"
        >
          {{ started && !running ? 'Run again' : 'Optimize images' }}
        </Button>
      </div>
    </div>

    <div
      v-if="failed.length"
      class="mt-6"
    >
      <h3 class="font-heading text-lg font-semibold">
        Failed images
      </h3>
      <ul
        data-testid="failed"
        class="mt-2 flex flex-col gap-1 text-sm"
      >
        <li
          v-for="f in failed"
          :key="f.key"
          class="break-all"
        >
          <span class="font-mono">{{ f.key }}</span>
          <span class="text-muted-foreground"> — {{ f.reason }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Profile = 'orgLogo' | 'banner' | 'frame'
interface PendingItem { key: string; profile: Profile }

// The variants endpoint allows 30 requests a minute per user; one item every
// 2.5 s stays well under it. A 429 still backs off and retries.
const props = withDefaults(defineProps<{ paceMs?: number; backoffMs?: number }>(), {
  paceMs: 2500,
  backoffMs: 15000,
})

const MAX_RETRIES = 3

const items = ref<PendingItem[]>([])
const total = ref(0)
const done = ref(0)
const failed = ref<{ key: string; reason: string }[]>([])
const loading = ref(true)
const loadError = ref('')
const started = ref(false)
const running = ref(false)
const waiting = ref(false)

const summary = computed(() => {
  const base = `Done: ${done.value - failed.value.length} of ${total.value} optimized`
  return failed.value.length ? `${base}, ${failed.value.length} failed` : base
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.get<{ items: PendingItem[] }>('/api/admin/media/pending')
    items.value = data.items
    total.value = data.items.length
  } catch {
    loadError.value = 'Could not load the image list. Try again.'
  } finally {
    loading.value = false
  }
}

async function optimize(item: PendingItem): Promise<void> {
  const res = await fetch(`/media/${item.key}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Could not read the original (${res.status})`)
  const blob = await res.blob()
  const { makeVariants } = await import('@/lib/images/variants')
  const { meta, variants } = await makeVariants(blob, item.profile)
  const body = JSON.stringify({
    key: item.key,
    placeholder: meta.ph,
    meta: { w: meta.w, h: meta.h, fmt: meta.fmt, widths: meta.widths },
    variants,
  })
  for (let attempt = 0; ; attempt += 1) {
    const put = await api.raw('/api/media/variants', { method: 'PUT', body })
    if (put.ok) return
    if (put.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(put.headers.get('Retry-After'))
      waiting.value = true
      await sleep(retryAfter > 0 ? retryAfter * 1000 : props.backoffMs)
      waiting.value = false
      continue
    }
    throw new Error(put.status === 429 ? 'Rate limited' : `Upload refused (${put.status})`)
  }
}

async function start() {
  if (running.value) return
  running.value = true
  started.value = true
  done.value = 0
  failed.value = []
  const queue = [...items.value]
  for (const [i, item] of queue.entries()) {
    try {
      await optimize(item)
    } catch (err) {
      failed.value.push({ key: item.key, reason: err instanceof Error ? err.message : 'Failed' })
    }
    done.value = i + 1
    if (i < queue.length - 1) await sleep(props.paceMs)
  }
  running.value = false
}

onMounted(() => { void load() })
</script>

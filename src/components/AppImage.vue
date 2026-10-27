<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { variantUrl } from '@/lib/images/variantUrl'
import type { ImageMeta } from '@/lib/images/variants'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    src: string
    meta?: ImageMeta | null
    alt?: string
    sizes?: string
    /** Above-the-fold image: loads eagerly at high priority. */
    priority?: boolean
  }>(),
  { meta: null, alt: '', sizes: undefined, priority: false },
)

const el = ref<HTMLImageElement | null>(null)
const loaded = ref(false)
/** A variant failed to load: fall back to the plain original, once. */
const failed = ref(false)

const meta = computed(() => (failed.value ? null : props.meta))

const stored = computed(() => !props.src.startsWith('data:') && !props.src.startsWith('blob:'))

const srcset = computed(() => {
  const m = meta.value
  if (!m || !stored.value || m.widths.length === 0) return undefined
  const parts = m.widths.map((w) => `${variantUrl(props.src, w, m.fmt)} ${w}w`)
  parts.push(`${props.src} ${m.w}w`)
  return parts.join(', ')
})

// Only a plain base64 image data URL goes into CSS url(); anything with quotes,
// parens, backslashes or newlines is dropped rather than escaped.
const SAFE_PLACEHOLDER = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/

const placeholderStyle = computed(() => {
  const ph = meta.value?.ph
  if (loaded.value || !ph || !SAFE_PLACEHOLDER.test(ph)) return undefined
  return { backgroundImage: `url("${ph}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
})

watch(() => props.src, () => {
  loaded.value = false
  failed.value = false
})

onMounted(() => {
  if (el.value?.complete && el.value.naturalWidth > 0) loaded.value = true
})
</script>

<template>
  <img
    v-bind="$attrs"
    ref="el"
    :src="src"
    :srcset="srcset"
    :sizes="srcset ? sizes : undefined"
    :alt="alt"
    :width="meta?.w"
    :height="meta?.h"
    :loading="priority ? undefined : 'lazy'"
    :fetchpriority="priority ? 'high' : undefined"
    decoding="async"
    :style="placeholderStyle"
    @error="failed = true"
    @load="loaded = true"
  >
</template>

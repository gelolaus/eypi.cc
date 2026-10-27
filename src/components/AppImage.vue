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

const stored = computed(() => !props.src.startsWith('data:') && !props.src.startsWith('blob:'))

const srcset = computed(() => {
  const meta = props.meta
  if (!meta || !stored.value || meta.widths.length === 0) return undefined
  const parts = meta.widths.map((w) => `${variantUrl(props.src, w, meta.fmt)} ${w}w`)
  parts.push(`${props.src} ${meta.w}w`)
  return parts.join(', ')
})

const placeholderStyle = computed(() => {
  const ph = props.meta?.ph
  if (loaded.value || !ph || !ph.startsWith('data:image/')) return undefined
  return { backgroundImage: `url("${ph}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
})

watch(() => props.src, () => {
  loaded.value = false
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
    @load="loaded = true"
  >
</template>

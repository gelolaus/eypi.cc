<template>
  <div aria-hidden="true" />
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import { inject, onMounted, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type AppTransition from '@/components/AppTransition.vue'

const route = useRoute()
const router = useRouter()
const currentSlug = ref((route.params.slug as string) ?? '')
const appTransition = inject<Ref<InstanceType<typeof AppTransition> | null> | null>('appTransition', null)

function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

onMounted(async () => {
  const slug = currentSlug.value
  const animationPromise = appTransition?.value?.trigger() ?? Promise.resolve()
  const referrer = encodeURIComponent(document.referrer || '')
  const fetchPromise = api.raw(`/api/links/resolve/${encodeURIComponent(slug)}?r=${referrer}${route.query.src === 'qr' ? '&src=qr' : ''}`)
    .then(async (res) => {
      const data = await res.json().catch(() => null) as { url?: string; protected?: boolean } | null
      return { status: res.status, data }
    })
    .catch(() => null)

  const [, result] = await Promise.all([animationPromise, fetchPromise])

  if (result?.status === 410) {
    await router.replace('/expired')
    return
  }
  if (result?.data?.protected) {
    await router.replace(route.query.src === 'qr' ? `/unlock/${slug}?src=qr` : `/unlock/${slug}`)
    return
  }
  if (result?.data?.url && isSafeRedirect(result.data.url)) {
    window.location.replace(result.data.url)
    return
  }
  await router.replace({
    name: 'not-found',
    params: { pathMatch: [slug] },
  })
})
</script>

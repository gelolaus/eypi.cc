<template>
  <div aria-hidden="true" />
</template>

<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import type AppTransition from '@/components/AppTransition.vue'

const route = useRoute()
const router = useRouter()
const currentSlug = ref((route.params.slug as string) ?? '')
const appTransition = inject<Ref<InstanceType<typeof AppTransition> | null>>('appTransition')

function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

onMounted(async () => {
  const clientReferrer = document.referrer

  const animationPromise = appTransition?.value?.trigger() ?? Promise.resolve()

  const fetchPromise = fetch(`${API_BASE_URL}/api/links/${currentSlug.value}`, {
    headers: clientReferrer ? { 'X-Client-Referrer': clientReferrer } : {},
  })
    .then((r) => r.json())
    .catch(() => null)

  const [, data] = await Promise.all([animationPromise, fetchPromise])

  if (data?.original_url && isSafeRedirect(data.original_url)) {
    window.location.replace(data.original_url)
  } else {
    router.replace({
      name: 'not-found',
      params: { pathMatch: [currentSlug.value] },
    })
  }
})
</script>

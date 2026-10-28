<template>
  <a
    href="#app-content"
    class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
  >Skip to content</a>

  <!-- Page transition overlay -->
  <AppTransition ref="appTransitionRef" />

  <!-- Until the first navigation settles there is no layout yet and the lazy route chunk is still loading. -->
  <div v-if="!routerReady" role="status" aria-busy="true" data-boot-skeleton>
    <div class="h-16 border-b border-border" />
    <div class="mx-auto max-w-5xl space-y-4 p-4">
      <div class="h-28 rounded-3xl bg-muted motion-safe:animate-pulse" />
      <div class="h-28 rounded-3xl bg-muted motion-safe:animate-pulse" />
    </div>
    <span class="sr-only">Loading</span>
  </div>
  <component :is="Shell" v-else>
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </component>

  <!-- Toasts and dialogs pull in vue-sonner and reka-ui. Mount them on first use. -->
  <ToastContainer v-if="toastsNeeded" />
  <DialogHost v-if="dialogNeeded" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component as VueComponent, ref, provide, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadAppShell } from '@/components/layout/loadAppShell'
import PublicShell from '@/components/layout/PublicShell.vue'
import { reloadOnceForChunkError } from '@/lib/chunkReload'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import AppTransition from '@/components/AppTransition.vue'

// The signed-in shell is only fetched on app pages. Public pages never pay for it.
const AppShell = defineAsyncComponent(loadAppShell)
// Retry once, then reload once on a stale chunk, so a dialog never hangs unseen.
function lazyHost(load: () => Promise<VueComponent>) {
  return defineAsyncComponent({
    loader: load,
    onError(err, retry, fail, attempts) {
      if (attempts <= 1) retry()
      else if (!reloadOnceForChunkError(err, window.location.pathname + window.location.search)) fail()
    },
  })
}
const ToastContainer = lazyHost(() => import('@/components/ToastContainer.vue'))
const DialogHost = lazyHost(() => import('@/components/DialogHost.vue'))

// Latches stay true once set so an open overlay never unmounts mid-animation.
const { toasts } = useToast()
const { current: currentDialog } = useDialog()
const toastsNeeded = ref(toasts.value.length > 0)
const dialogNeeded = ref(currentDialog.value !== null)
watch(() => toasts.value.length, (n) => { if (n > 0) toastsNeeded.value = true })
watch(currentDialog, (d) => { if (d) dialogNeeded.value = true })

const route = useRoute()
const router = useRouter()
const routerReady = ref(false)
// Also clear on a failed first navigation, so the router error path renders instead of an endless skeleton.
const markReady = () => { routerReady.value = true }
void router.isReady().then(markReady, markReady)
const Shell = computed(() => (route.meta.layout === 'public' ? PublicShell : AppShell))

const appTransitionRef = ref<InstanceType<typeof AppTransition> | null>(null)

provide('appTransition', appTransitionRef)
</script>

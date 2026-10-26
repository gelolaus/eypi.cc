<template>
  <div
    v-if="open"
    class="fixed inset-0"
    style="z-index: 99990"
  >
    <button
      aria-label="Close panel"
      class="absolute inset-0 bg-black/20 backdrop-blur-sm"
      type="button"
      @click="emit('close')"
    />
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- dialog handles focus and Escape -->
    <div
      id="link-editor"
      ref="panel"
      aria-labelledby="link-editor-title"
      aria-modal="true"
      class="absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl border-t border-gray-200 bg-white p-5 shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0 sm:p-8 dark:border-slate-700/50 dark:bg-slate-900"
      role="dialog"
      tabindex="-1"
      @keydown.esc.stop="emit('close')"
    >
      <button
        aria-label="Close"
        class="absolute right-2 top-2 flex size-11 items-center justify-center text-2xl text-gray-500 sm:right-5 sm:top-5 hover:text-gray-700 dark:text-slate-400"
        type="button"
        @click="emit('close')"
      >
        &times;
      </button>
      <h2
        id="link-editor-title"
        class="text-section-title mb-8 text-g-primary dark:text-slate-200"
      >
        {{ linkId ? 'Edit link' : 'New link' }}
      </h2>
      <div class="mb-4">
        <label
          class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
          for="link-destination"
        >
          Destination
        </label>
        <input
          id="link-destination"
          v-model="url"
          aria-label="Destination"
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
          type="url"
          :aria-describedby="urlError ? 'destination-error' : undefined"
          :aria-invalid="Boolean(urlError)"
          @input="urlError = ''"
        >
        <p
          v-if="urlError"
          id="destination-error"
          class="mt-1 text-sm text-red-500"
          role="alert"
        >
          {{ urlError }}
        </p>
      </div>
      <div class="mb-4">
        <label
          class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
          for="link-slug"
        >
          Custom slug
        </label>
        <div class="flex items-center rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 focus-within:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input">
          <span class="shrink-0 font-mono font-bold text-g-primary dark:text-slate-200">eypi.cc/</span>
          <input
            id="link-slug"
            aria-label="Custom slug"
            class="min-w-0 flex-1 border-0 bg-transparent font-mono outline-none dark:text-slate-200"
            type="text"
            :aria-describedby="slugDescribedBy"
            :aria-invalid="Boolean(slugError)"
            :value="slug"
            @input="onSlugInput"
          >
        </div>
        <p
          id="slug-help"
          class="mt-1 text-sm text-g-muted"
        >
          Optional. Lowercase letters, numbers, and hyphens.
        </p>
        <p
          v-if="availability"
          id="slug-availability"
          aria-live="polite"
          class="mt-1 text-sm text-g-text"
        >
          {{ availability }}
        </p>
        <p
          v-if="slugError"
          id="slug-error"
          class="mt-1 text-sm text-red-500"
          role="alert"
        >
          {{ slugError }}
        </p>
      </div>
      <LinkAdvancedFields
        :expires-at="expiresAt"
        :password="password"
        :url="url"
        @update:expires-at="expiresAt = $event"
        @update:password="password = $event"
        @update:url="url = $event"
      />
      <p
        v-if="passwordError"
        class="mt-2 text-sm text-red-500"
        role="alert"
      >
        {{ passwordError }}
      </p>
      <label
        v-if="linkId && protectedLink"
        class="mt-4 flex items-center gap-2 text-sm text-g-text"
      >
        <input
          v-model="clearPassword"
          class="h-4 w-4 accent-g-accent"
          type="checkbox"
        >
        Remove password
      </label>
      <QrDesigner
        :config="qrConfig"
        :link-id="linkId"
        :slug="slug"
        :track-scans="trackScans"
        @update:config="qrConfig = $event"
        @update:track-scans="trackScans = $event"
        @uploading="qrImageBusy = $event"
      />
      <p
        v-if="formError"
        class="mt-4 text-sm text-red-500"
        role="alert"
      >
        {{ formError }}
      </p>
      <div class="sticky bottom-0 -mx-5 mt-6 border-t border-gray-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:-mx-8 sm:-mb-8 sm:px-8 dark:border-slate-700/50 dark:bg-slate-900">
        <button
          class="btn-gold min-h-12 w-full rounded-xl px-8 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          :disabled="saving || qrImageBusy"
          @click="submit"
        >
          {{ linkId ? 'Save changes' : 'Create link' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onScopeDispose, ref, watch } from 'vue'
import { ApiError, api } from '@/lib/api'
import { DEFAULT_LINK_QR_CONFIG, parseLinkQrConfig, type LinkQrConfig } from '@shared/linkQrConfig'
import { normalizeSlugInput, validateSlug } from '@shared/slugRules'
import { validateDestination, type DestinationCode } from '@shared/urlSafety'
import { linksKey, useLinks, type LinkDetail } from '@/composables/useLinks'
import { useFocusTrap } from '@/composables/useFocusTrap'
import LinkAdvancedFields from '@/components/links/LinkAdvancedFields.vue'
import QrDesigner from '@/components/links/QrDesigner.vue'

const SELF_HOSTS = ['eypi.cc']

const props = defineProps<{
  open: boolean
  linkId: string | null
  destination?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const links = inject(linksKey, null) ?? useLinks()
const panel = ref<HTMLElement | null>(null)
const trap = useFocusTrap(panel)

const url = ref('')
const slug = ref('')
const originalSlug = ref('')
const expiresAt = ref('')
const password = ref('')
const clearPassword = ref(false)
const protectedLink = ref(false)
const qrConfig = ref<LinkQrConfig>({ ...DEFAULT_LINK_QR_CONFIG })
const trackScans = ref(true)
const availability = ref('')
const urlError = ref('')
const slugError = ref('')
const passwordError = ref('')
const formError = ref('')
const saving = ref(false)
const qrImageBusy = ref(false)

const slugDescribedBy = computed(() => {
  const ids = ['slug-help']
  if (availability.value) ids.push('slug-availability')
  if (slugError.value) ids.push('slug-error')
  return ids.join(' ')
})

let timer: ReturnType<typeof setTimeout> | undefined
let requestId = 0
let detailRequest = 0

function destinationError(code: DestinationCode): string {
  if (code === 'userinfo') return 'Remove the username from that URL.'
  if (code === 'self_link') return 'That destination points at eypi.cc.'
  if (code === 'shortener') return 'Use the full destination instead of another shortener.'
  if (code === 'private_address' || code === 'blocked_host') return 'That destination is not allowed.'
  return 'Enter a valid http or https URL.'
}

function availabilityLabel(result: { available: boolean; reason?: string }): string {
  if (result.available) return 'Available'
  if (result.reason === 'taken') return 'Taken'
  if (result.reason === 'reserved') return 'Reserved'
  return 'Not allowed'
}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = undefined
  requestId += 1
}

function resetCreate(destination = '') {
  clearTimer()
  url.value = destination
  slug.value = ''
  originalSlug.value = ''
  expiresAt.value = ''
  password.value = ''
  clearPassword.value = false
  protectedLink.value = false
  qrConfig.value = { ...DEFAULT_LINK_QR_CONFIG }
  trackScans.value = true
  availability.value = ''
  urlError.value = ''
  slugError.value = ''
  passwordError.value = ''
  formError.value = ''
}

function toLocalExpires(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const manila = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${manila.getUTCFullYear()}-${pad(manila.getUTCMonth() + 1)}-${pad(manila.getUTCDate())}T${pad(manila.getUTCHours())}:${pad(manila.getUTCMinutes())}`
}

function expiresToIso(value: string): string | null {
  if (!value) return null
  const parsed = new Date(`${value}:00+08:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

async function loadLink(id: string) {
  const request = ++detailRequest
  resetCreate()
  try {
    const detail = await api.get<LinkDetail>(`/api/links/${id}`)
    if (request !== detailRequest || !props.open || props.linkId !== id) return
    url.value = detail.url
    slug.value = detail.slug
    originalSlug.value = detail.slug
    expiresAt.value = toLocalExpires(detail.expiresAt)
    protectedLink.value = detail.protected
    qrConfig.value = parseLinkQrConfig(detail.qrConfig)
  } catch (err) {
    if (request !== detailRequest || !props.open || props.linkId !== id) return
    if (err instanceof ApiError && err.status === 401) return
    formError.value = err instanceof Error ? err.message : 'Could not load this link.'
  }
}

function onSlugInput(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const next = input.value.toLowerCase()
  slug.value = next
  if (input.value !== next) input.value = next
  slugError.value = ''
  availability.value = ''
  clearTimer()
  const normalized = normalizeSlugInput(next)
  if (!normalized || normalized === originalSlug.value) return
  timer = setTimeout(() => { void checkAvailability(normalized) }, 300)
}

async function checkAvailability(slugValue: string) {
  const id = ++requestId
  try {
    const result = await api.get<{ available: boolean; reason?: string }>(
      `/api/links/slug-available?slug=${encodeURIComponent(slugValue)}`,
    )
    if (id !== requestId) return
    if (normalizeSlugInput(slug.value) !== slugValue) return
    availability.value = availabilityLabel(result)
  } catch {
    if (id === requestId) availability.value = ''
  }
}

async function submit() {
  if (saving.value || qrImageBusy.value) return
  urlError.value = ''
  slugError.value = ''
  passwordError.value = ''
  formError.value = ''
  const destination = validateDestination(url.value, { selfHosts: SELF_HOSTS })
  if (!destination.ok) {
    urlError.value = destinationError(destination.code)
    return
  }
  if (password.value && (password.value.length < 8 || password.value.length > 128)) {
    passwordError.value = 'Use 8 to 128 characters.'
    return
  }
  const slugValue = normalizeSlugInput(slug.value)
  if (slugValue && validateSlug(slugValue) !== 'ok') {
    const verdict = validateSlug(slugValue)
    slugError.value = verdict === 'reserved'
      ? 'That slug is reserved.'
      : 'Use lowercase letters, numbers, and hyphens.'
    return
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(qrConfig.value.color.trim())) {
    formError.value = 'Matrix color must be a hex value like #DEAC4B.'
    return
  }
  const body = {
    url: destination.url,
    slug: slugValue || undefined,
    expiresAt: expiresToIso(expiresAt.value),
    password: clearPassword.value ? '' : (password.value || undefined),
    qrConfig: qrConfig.value,
  }
  saving.value = true
  try {
    if (props.linkId) await links.update(props.linkId, body)
    else await links.create(body)
    emit('close')
  } catch (err) {
    if (err instanceof ApiError) {
      urlError.value = err.fields?.url ?? ''
      slugError.value = err.fields?.slug ?? ''
      passwordError.value = err.fields?.password ?? ''
      if (err.fields?.expiresAt) formError.value = err.fields.expiresAt
      if (!urlError.value && !slugError.value && !passwordError.value && !formError.value) {
        formError.value = err.message
      }
    } else {
      formError.value = 'Could not save this link.'
    }
  } finally {
    saving.value = false
  }
}

watch(() => [props.open, props.linkId] as const, ([open, id]) => {
  if (!open) {
    detailRequest += 1
    trap.release()
    clearTimer()
    return
  }
  if (id) void loadLink(id)
  else {
    detailRequest += 1
    resetCreate(props.destination ?? '')
  }
  void nextTick(() => trap.activate())
}, { immediate: true })

onScopeDispose(() => {
  clearTimer()
  trap.release()
})
</script>

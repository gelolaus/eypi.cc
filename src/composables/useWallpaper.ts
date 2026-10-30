import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { parseRams } from '@shared/schedule/parseRams'
import type { ParsedSchedule } from '@shared/schedule/types'
import { isSmallerThan, loadPhoto } from '@/lib/wallpaper/background'
import { DEFAULT_SIZE, clampSize, detectSize } from '@/lib/wallpaper/sizes'
import type { Size } from '@/lib/wallpaper/sizes'
import type { LayoutId, ThemeName } from '@/lib/wallpaper/types'

const DEBOUNCE_MS = 150
const SMALL_PHOTO_NOTICE = 'This photo is smaller than the wallpaper, so it may look soft.'

function detectedSize(): Size | null {
  if (typeof window === 'undefined') return null
  return detectSize({
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    pixelRatio: window.devicePixelRatio || 1,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
  })
}

/** State for the wallpaper page: the pasted text, the choices, and the optional photo. Nothing is stored. */
export function useWallpaper(): {
  text: Ref<string>
  parsed: ComputedRef<ParsedSchedule>
  layout: Ref<LayoutId>
  theme: Ref<ThemeName>
  size: Ref<Size>
  photo: Ref<ImageBitmap | null>
  dim: Ref<number>
  photoNotice: ComputedRef<string | null>
  photoError: Ref<string | null>
  hasSchedule: ComputedRef<boolean>
  /** True while the pasted text has not been parsed yet (the 150 ms debounce). */
  pending: ComputedRef<boolean>
  setPhoto: (file: File) => Promise<void>
  clearPhoto: () => void
} {
  const text = ref('')
  const settled = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(text, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => { settled.value = value }, DEBOUNCE_MS)
  }, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(() => clearTimeout(timer))

  const parsed = computed(() => parseRams(settled.value))
  const hasSchedule = computed(() => parsed.value.subjects.length > 0)
  const pending = computed(() => text.value !== settled.value)

  const layout = ref<LayoutId>('agenda')
  const theme = ref<ThemeName>('dark')
  const dim = ref(0.45)

  const rawSize = ref<Size>(clampSize(detectedSize() ?? DEFAULT_SIZE))
  const size = computed<Size>({
    get: () => rawSize.value,
    set: (value) => { rawSize.value = clampSize(value) },
  })

  const photo = shallowRef<ImageBitmap | null>(null)
  const photoError = ref<string | null>(null)
  const photoNotice = computed(() =>
    photo.value && isSmallerThan(photo.value, size.value.width, size.value.height) ? SMALL_PHOTO_NOTICE : null)

  async function setPhoto(file: File): Promise<void> {
    try {
      const next = await loadPhoto(file)
      photo.value?.close?.()
      photo.value = next
      photoError.value = null
    } catch (error) {
      photoError.value = error instanceof Error ? error.message : 'Choose an image file.'
    }
  }

  function clearPhoto(): void {
    photo.value?.close?.()
    photo.value = null
    photoError.value = null
  }

  return { text, parsed, layout, theme, size, photo, dim, photoNotice, photoError, hasSchedule, pending, setPhoto, clearPhoto }
}

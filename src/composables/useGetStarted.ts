import { computed, ref, type ComputedRef, type Ref } from 'vue'

export type GetStartedStep = {
  id: 'link' | 'wallpaper' | 'invites'
  label: string
  to: string
  done: boolean
}

const DISMISSED_KEY = 'eypi.getStartedDismissed'
const WALLPAPER_KEY = 'eypi.wallpaperMade'
const INVITES_KEY = 'eypi.invitesSeen'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): boolean {
  try {
    localStorage.setItem(key, '1')
    return true
  } catch {
    return false
  }
}

const dismissed = ref(readFlag(DISMISSED_KEY))
const wallpaperMade = ref(readFlag(WALLPAPER_KEY))
const invitesSeen = ref(readFlag(INVITES_KEY))

function syncFromStorage(): void {
  dismissed.value = readFlag(DISMISSED_KEY)
  wallpaperMade.value = readFlag(WALLPAPER_KEY)
  invitesSeen.value = readFlag(INVITES_KEY)
}

/** Test helper: re-read flags after localStorage.clear(). */
export function resetGetStartedState(): void {
  syncFromStorage()
}

export function markWallpaperMade(): void {
  if (writeFlag(WALLPAPER_KEY)) wallpaperMade.value = true
}

export function markInvitesSeen(): void {
  if (writeFlag(INVITES_KEY)) invitesSeen.value = true
}

export function useGetStarted(inputs: {
  linkCount: Ref<number | null>
  pendingInvites: Ref<number>
}): {
  steps: ComputedRef<GetStartedStep[]>
  visible: ComputedRef<boolean>
  dismiss: () => void
} {
  syncFromStorage()

  const steps = computed<GetStartedStep[]>(() => [
    {
      id: 'link',
      label: 'Create your first link',
      to: '/links',
      done: (inputs.linkCount.value ?? 0) > 0,
    },
    {
      id: 'wallpaper',
      label: 'Make a wallpaper from your schedule',
      to: '/wallpaper',
      done: wallpaperMade.value,
    },
    {
      id: 'invites',
      label: 'Check your invites',
      to: '/invites',
      done: invitesSeen.value && inputs.pendingInvites.value === 0,
    },
  ])

  const visible = computed(() => {
    if (inputs.linkCount.value === null) return false
    if (inputs.linkCount.value >= 3) return false
    if (dismissed.value) return false
    if (steps.value.every((s) => s.done)) return false
    return true
  })

  function dismiss(): void {
    if (writeFlag(DISMISSED_KEY)) dismissed.value = true
  }

  return { steps, visible, dismiss }
}
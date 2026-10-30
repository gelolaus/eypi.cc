import { ref } from 'vue'

export const WALLPAPER_INTRO_KEY = 'eypi.wallpaper.intro.dismissed'

function dismissedBefore(): boolean {
  try {
    return localStorage.getItem(WALLPAPER_INTRO_KEY) === 'true'
  } catch {
    return false
  }
}

/** The welcome video on the Wallpaper page. It opens until the visitor asks never to see it again, remembered per browser. */
export function useWallpaperIntro() {
  const open = ref(!dismissedBefore())

  function close(remember: boolean) {
    open.value = false
    if (!remember) return
    try {
      localStorage.setItem(WALLPAPER_INTRO_KEY, 'true')
    } catch {
      // It stays closed for this visit when storage is unavailable.
    }
  }

  return { open, close }
}

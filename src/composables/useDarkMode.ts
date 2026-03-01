import { ref, watch } from 'vue'

const STORAGE_KEY = 'eypi_dark_mode'

function getStored(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return false
}

function apply(isDark: boolean) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  if (isDark) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function useDarkMode() {
  const isDark = ref(getStored())
  apply(isDark.value)

  watch(isDark, (val) => {
    apply(val)
    localStorage.setItem(STORAGE_KEY, String(val))
  })

  function toggle() {
    isDark.value = !isDark.value
  }

  return { isDark, toggle }
}

import { ref } from 'vue'

const STORAGE_KEY = 'eypi.rail.collapsed'

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Whether the side rail shows icons only. The choice is remembered per browser. */
export function useRailCollapsed() {
  const collapsed = ref(read())

  function toggle() {
    collapsed.value = !collapsed.value
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed.value))
    } catch {
      // The rail still toggles for this visit when storage is unavailable.
    }
  }

  return { collapsed, toggle }
}

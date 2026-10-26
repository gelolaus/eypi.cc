import { ref } from 'vue'

/** Shared open state for the navigation drawer (header menu button and tab bar "More"). */
const isOpen = ref(false)

export function useNavDrawer() {
  return {
    isOpen,
    open: () => {
      isOpen.value = true
    },
    close: () => {
      isOpen.value = false
    },
    toggle: () => {
      isOpen.value = !isOpen.value
    },
  }
}

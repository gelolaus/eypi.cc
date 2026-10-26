import { ref } from 'vue'

/**
 * The element that scrolls page content. The app shell sets it to its content pane;
 * `null` means the document scrolls (public pages).
 */
const container = ref<HTMLElement | null>(null)

export function useScrollContainer() {
  function scrollTop(): number {
    return container.value ? container.value.scrollTop : window.scrollY
  }

  function scrollToTop(behavior: ScrollBehavior) {
    if (container.value) container.value.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }

  return { container, scrollTop, scrollToTop }
}

import { onMounted, onUnmounted } from 'vue'

export function useReveal(selector = '.reveal') {
  let observer: IntersectionObserver | null = null
  let mutationObserver: MutationObserver | null = null

  onMounted(() => {
    // Helper to register and observe a reveal element
    const observeEl = (el: Element) => {
      if (el.classList.contains('is-revealed-registered')) return
      el.classList.add('is-revealed-registered')

      if (!window.IntersectionObserver) {
        el.classList.add('is-visible')
        return
      }

      observer!.observe(el)
      // Safety fallback: reveal the element anyway if the observer hasn't triggered after 1 second
      setTimeout(() => {
        el.classList.add('is-visible')
      }, 1000)
    }

    // Setup IntersectionObserver
    if (window.IntersectionObserver) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible')
              observer?.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.01, rootMargin: '0px' },
      )
    }

    // Observe elements currently in the DOM
    document.querySelectorAll<Element>(selector).forEach(observeEl)

    // Setup MutationObserver to watch for elements added dynamically later (e.g. after async fetch completes)
    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.matches(selector)) {
              observeEl(el)
            }
            el.querySelectorAll<Element>(selector).forEach(observeEl)
          }
        })
      })
    })

    mutationObserver.observe(document.body, { childList: true, subtree: true })
  })

  onUnmounted(() => {
    observer?.disconnect()
    mutationObserver?.disconnect()
  })
}

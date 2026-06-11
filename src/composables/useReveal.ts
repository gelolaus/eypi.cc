import { onMounted, onUnmounted } from 'vue'

export function useReveal(selector = '.reveal') {
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!window.IntersectionObserver) {
      document.querySelectorAll<Element>(selector).forEach((el) => {
        el.classList.add('is-visible')
      })
      return
    }

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

    document.querySelectorAll<Element>(selector).forEach((el) => {
      observer!.observe(el)
      // Safety fallback: reveal the element anyway if the observer hasn't triggered after 1 second
      setTimeout(() => {
        el.classList.add('is-visible')
      }, 1000)
    })
  })

  onUnmounted(() => observer?.disconnect())
}

import { onMounted, onUnmounted } from 'vue'

export function useKeyboardNav() {
  function getSections(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('section[id], [data-section]'))
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.code !== 'Space') return
    const target = e.target as HTMLElement
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return
    if (target.isContentEditable) return

    const sections = getSections()
    if (!sections.length) return

    e.preventDefault()

    const scrollY = window.scrollY + window.innerHeight * 0.3

    const next = sections.find((s) => s.offsetTop > scrollY)
    const dest = next ?? sections[0]

    dest.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}

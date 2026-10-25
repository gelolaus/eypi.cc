import { getCurrentScope, onScopeDispose, type Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useFocusTrap(container: Ref<HTMLElement | null>) {
  let previouslyFocused: HTMLElement | null = null
  let listening = false

  function getFocusable(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
      if (el.tabIndex < 0) return false
      if (el.closest('[inert]')) return false
      if (el.getAttribute('aria-hidden') === 'true') return false
      return true
    })
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !container.value) return
    const items = getFocusable()
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const current = document.activeElement
    const inside = current instanceof Node && container.value.contains(current)
    if (event.shiftKey) {
      if (!inside || current === first) {
        event.preventDefault()
        last.focus()
      }
      return
    }
    if (!inside || current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function activate(preferred?: HTMLElement | null) {
    const current = document.activeElement
    if (
      previouslyFocused == null
      && current instanceof HTMLElement
      && current !== document.body
      && !container.value?.contains(current)
    ) {
      previouslyFocused = current
    }
    if (!listening) {
      document.addEventListener('keydown', onKeydown)
      listening = true
    }
    const items = getFocusable()
    const target = preferred && container.value?.contains(preferred) ? preferred : items[0]
    target?.focus()
  }

  function release() {
    if (listening) {
      document.removeEventListener('keydown', onKeydown)
      listening = false
    }
    const restore = previouslyFocused
    previouslyFocused = null
    if (restore?.isConnected) restore.focus()
  }

  if (getCurrentScope()) onScopeDispose(release)

  return { activate, release }
}

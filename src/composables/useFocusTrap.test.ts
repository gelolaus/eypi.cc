// @vitest-environment happy-dom
import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function keydown(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

describe('useFocusTrap', () => {
  it('cycles Tab inside the container and restores focus on release', async () => {
    document.body.innerHTML = `
      <button id="before" type="button">Before</button>
      <div id="trap">
        <button id="first" type="button">First</button>
        <button id="last" type="button">Last</button>
      </div>
      <button id="after" type="button">After</button>
    `
    const before = document.getElementById('before') as HTMLButtonElement
    const trap = document.getElementById('trap') as HTMLDivElement
    const first = document.getElementById('first') as HTMLButtonElement
    const last = document.getElementById('last') as HTMLButtonElement
    const container = ref<HTMLElement | null>(trap)

    before.focus()
    const { activate, release } = useFocusTrap(container)
    activate()
    await nextTick()

    expect(document.activeElement).toBe(first)

    last.focus()
    const forward = keydown('Tab')
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    const backward = keydown('Tab', { shiftKey: true })
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    release()
    expect(document.activeElement).toBe(before)
  })
})

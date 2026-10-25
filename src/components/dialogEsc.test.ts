// @vitest-environment happy-dom
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import DialogHost from './DialogHost.vue'
import ToastContainer from './ToastContainer.vue'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

const Host = defineComponent({
  components: { DialogHost, ToastContainer },
  template: '<div><button id="opener" type="button">Open</button><DialogHost /><ToastContainer /></div>',
})

afterEach(() => {
  const toast = useToast()
  while (toast.toasts.value.length > 0) {
    toast.dismiss(toast.toasts.value[0].id)
  }
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
})

describe('dialog Escape', () => {
  it('does not dismiss a toast when Escape closes a dialog', async () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const opener = wrapper.get('#opener').element as HTMLButtonElement
    opener.focus()

    const toast = useToast()
    toast.info('Saved')
    const dialog = useDialog()
    const pending = dialog.info({ title: 'Notice', body: 'Hello' })
    await nextTick()
    await nextTick()

    const panel = document.querySelector('[role="dialog"]') as HTMLElement
    expect(panel).toBeTruthy()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()

    expect(toast.toasts.value.map((item) => item.message)).toContain('Saved')
    expect(dialog.current.value).toBeNull()
    expect(document.activeElement).toBe(opener)

    await pending
    wrapper.unmount()
  })
})

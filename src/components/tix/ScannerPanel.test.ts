// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const seen = vi.hoisted(() => ({ options: null as { onToken?: (t: string) => void } | null }))

vi.mock('@/composables/useQrScanner', () => ({
  useQrScanner: (options: { onToken?: (t: string) => void }) => (seen.options = options, {
    videoRef: ref(null),
    scannerError: ref(''),
    scanStatus: ref('idle'),
    scanMessage: ref(''),
    cameraStarting: ref(false),
    needsCameraPrompt: ref(true),
    hudLabel: ref('Ready'),
    hudClass: ref(''),
    hudBannerClass: ref(''),
    onEnableCameraClick: vi.fn(),
    stopScanner: vi.fn(),
  }),
}))

import ScannerPanel from './ScannerPanel.vue'

describe('ScannerPanel', () => {
  it('is a full-bleed viewport with a bottom action bar and 44px camera button', () => {
    const wrapper = mount(ScannerPanel, { props: { slug: 'launch' } })
    expect(wrapper.find('[data-scanner-viewport]').exists()).toBe(true)
    expect(wrapper.find('[data-scanner-actions]').exists()).toBe(true)
    const button = wrapper.find('[data-scanner-actions] button')
    expect(button.text()).toContain('Enable camera')
    expect(button.attributes('data-slot')).toBe('button')
    expect(wrapper.html()).not.toContain('max-w-sm')
  })
})

describe('ScannerPanel action bar', () => {
  it('is sticky at the bottom with safe-area padding', () => {
    const wrapper = mount(ScannerPanel, { props: { slug: 'launch' } })
    const bar = wrapper.get('[data-scanner-actions]')
    expect(bar.classes()).toContain('sticky')
    expect(bar.classes()).toContain('bottom-0')
    expect(bar.classes().join(' ')).toContain('safe-area-inset-bottom')
  })
})

describe('ScannerPanel emit-only mode', () => {
  it('emits the decoded token and leaves check-in to the parent', () => {
    const wrapper = mount(ScannerPanel, { props: { slug: 'launch', emitOnly: true } })
    seen.options?.onToken?.('tok-1')
    expect(wrapper.emitted('scan')).toEqual([['tok-1']])
  })

  it('checks people in itself by default', () => {
    mount(ScannerPanel, { props: { slug: 'launch' } })
    expect(seen.options?.onToken).toBeUndefined()
  })
})

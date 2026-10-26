// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/composables/useQrScanner', () => ({
  useQrScanner: () => ({
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
    expect(button.classes().join(' ')).toMatch(/min-h-11|btn-/)
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

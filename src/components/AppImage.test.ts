// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppImage from './AppImage.vue'
import type { ImageMeta } from '@/lib/images/variants'

const meta: ImageMeta = { w: 1000, h: 500, fmt: 'webp', widths: [256, 512], ph: 'data:image/webp;base64,AAAA' }

describe('AppImage', () => {
  it('lists every width in srcset and sets size attributes', () => {
    const img = mount(AppImage, { props: { src: '/media/orgs/a/logo-0a1b2c3d.png', meta, alt: 'Logo', sizes: '96px' } }).get('img')
    expect(img.attributes('srcset')).toBe(
      '/media/orgs/a/logo-0a1b2c3d-256.webp 256w, /media/orgs/a/logo-0a1b2c3d-512.webp 512w, /media/orgs/a/logo-0a1b2c3d.png 1000w',
    )
    expect(img.attributes('sizes')).toBe('96px')
    expect(img.attributes('width')).toBe('1000')
    expect(img.attributes('height')).toBe('500')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
    expect(img.attributes('alt')).toBe('Logo')
  })

  it('priority drops loading and raises fetchpriority', () => {
    const img = mount(AppImage, { props: { src: '/media/a-1.png', meta, priority: true } }).get('img')
    expect(img.attributes('loading')).toBeUndefined()
    expect(img.attributes('fetchpriority')).toBe('high')
  })

  it('renders a plain lazy src without meta', () => {
    const img = mount(AppImage, { props: { src: '/media/a-1.png' } }).get('img')
    expect(img.attributes('src')).toBe('/media/a-1.png')
    expect(img.attributes('srcset')).toBeUndefined()
    expect(img.attributes('width')).toBeUndefined()
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('style')).toBeUndefined()
  })

  it('skips srcset when no variants exist but keeps dimensions', () => {
    const img = mount(AppImage, { props: { src: '/media/a-1.png', meta: { ...meta, widths: [] } } }).get('img')
    expect(img.attributes('srcset')).toBeUndefined()
    expect(img.attributes('width')).toBe('1000')
  })

  it('shows the placeholder until load, and none when ph is empty', async () => {
    const wrapper = mount(AppImage, { props: { src: '/media/a-1.png', meta } })
    expect(wrapper.get('img').attributes('style')).toContain('data:image/webp;base64,AAAA')
    await wrapper.get('img').trigger('load')
    expect(wrapper.get('img').attributes('style') ?? '').not.toContain('data:image')
    const bare = mount(AppImage, { props: { src: '/media/a-1.png', meta: { ...meta, ph: '' } } })
    expect(bare.get('img').attributes('style')).toBeUndefined()
  })

  it('drops srcset and meta on error so the original is tried once', async () => {
    const wrapper = mount(AppImage, { props: { src: '/media/a-1.png', meta } })
    expect(wrapper.get('img').attributes('srcset')).toBeTruthy()
    await wrapper.get('img').trigger('error')
    const img = wrapper.get('img')
    expect(img.attributes('srcset')).toBeUndefined()
    expect(img.attributes('src')).toBe('/media/a-1.png')
    expect(img.attributes('width')).toBeUndefined()
    expect(img.attributes('style')).toBeUndefined()
    await img.trigger('error')
    expect(wrapper.get('img').attributes('src')).toBe('/media/a-1.png')
  })

  it('restores srcset when the src changes after an error', async () => {
    const wrapper = mount(AppImage, { props: { src: '/media/a-1.png', meta } })
    await wrapper.get('img').trigger('error')
    await wrapper.setProps({ src: '/media/b-2.png' })
    expect(wrapper.get('img').attributes('srcset')).toContain('/media/b-2-256.webp 256w')
  })

  it.each([
    'data:image/webp;base64,AA")}body{display:none',
    'data:image/webp;base64,AA\\AA',
    "data:image/webp;base64,AA'AA",
    'data:image/webp;base64,AA(AA)',
    'data:image/webp;base64,AA\nAA',
    'https://evil.example/x.png',
    'data:text/html;base64,AAAA',
  ])('ignores an unsafe placeholder %#', (ph) => {
    const img = mount(AppImage, { props: { src: '/media/a-1.png', meta: { ...meta, ph } } }).get('img')
    expect(img.attributes('style')).toBeUndefined()
  })

  it('passes class through to the img', () => {
    const img = mount(AppImage, { props: { src: '/x.png' }, attrs: { class: 'object-cover' } }).get('img')
    expect(img.classes()).toContain('object-cover')
  })
})

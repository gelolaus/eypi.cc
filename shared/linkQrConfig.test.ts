import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LINK_QR_CONFIG,
  QR_LOGO_DATA_URL_MAX,
  parseLinkQrConfig,
  prepareQrConfigForSave,
  serializeLinkQrConfig,
} from './linkQrConfig'

describe('parseLinkQrConfig', () => {
  it('returns defaults for null/invalid input', () => {
    expect(parseLinkQrConfig(null)).toEqual(DEFAULT_LINK_QR_CONFIG)
    expect(parseLinkQrConfig('nope')).toEqual(DEFAULT_LINK_QR_CONFIG)
    expect(parseLinkQrConfig({})).toEqual(DEFAULT_LINK_QR_CONFIG)
  })

  it('parses a valid stored JSON string', () => {
    const raw = serializeLinkQrConfig({
      ...DEFAULT_LINK_QR_CONFIG,
      dotType: 'dots',
      color: '#112233',
      logoDataUrl: 'data:image/png;base64,abc',
    })
    expect(parseLinkQrConfig(raw)).toEqual({
      ...DEFAULT_LINK_QR_CONFIG,
      dotType: 'dots',
      color: '#112233',
      logoDataUrl: 'data:image/png;base64,abc',
    })
  })

  it('rejects invalid color', () => {
    expect(
      parseLinkQrConfig({
        ...DEFAULT_LINK_QR_CONFIG,
        color: 'red',
      }),
    ).toEqual(DEFAULT_LINK_QR_CONFIG)
  })

  it('keeps styles when logo prefix is invalid', () => {
    expect(
      parseLinkQrConfig({
        ...DEFAULT_LINK_QR_CONFIG,
        dotType: 'rounded',
        logoDataUrl: 'https://evil.example/x.png',
      }),
    ).toEqual({
      ...DEFAULT_LINK_QR_CONFIG,
      dotType: 'rounded',
      logoDataUrl: null,
    })
  })
})

describe('prepareQrConfigForSave', () => {
  it('keeps a logo under the data-URL limit', () => {
    const config = {
      ...DEFAULT_LINK_QR_CONFIG,
      logoDataUrl: 'data:image/png;base64,' + 'a'.repeat(100),
    }
    const result = prepareQrConfigForSave(config)
    expect(result.logoOmitted).toBe(false)
    expect(result.config.logoDataUrl).toBe(config.logoDataUrl)
  })

  it('strips an oversized logo and flags logoOmitted', () => {
    const config = {
      ...DEFAULT_LINK_QR_CONFIG,
      logoDataUrl: 'data:image/png;base64,' + 'a'.repeat(QR_LOGO_DATA_URL_MAX),
    }
    const result = prepareQrConfigForSave(config)
    expect(result.logoOmitted).toBe(true)
    expect(result.config.logoDataUrl).toBeNull()
    expect(result.config.color).toBe(config.color)
  })

  it('treats empty logo as null without omitting flag', () => {
    const result = prepareQrConfigForSave({
      ...DEFAULT_LINK_QR_CONFIG,
      logoDataUrl: '',
    })
    expect(result.logoOmitted).toBe(false)
    expect(result.config.logoDataUrl).toBeNull()
  })
})

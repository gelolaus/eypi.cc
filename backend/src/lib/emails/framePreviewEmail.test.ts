import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.hoisted(() => vi.fn())

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

import { deliverFramePreviewEmail, renderFramePreviewEmail } from './framePreviewEmail'

describe('renderFramePreviewEmail', () => {
  it('names the campaign and escapes it in the html', () => {
    const rendered = renderFramePreviewEmail({ campaignTitle: '<b>Orientation</b>' })

    expect(rendered.subject).toBe('Your <b>Orientation</b> preview from Eypi')
    expect(rendered.html).not.toContain('<b>Orientation</b>')
    expect(rendered.html).toContain('&lt;b&gt;Orientation&lt;/b&gt;')
    expect(rendered.text).toContain('attached')
    expect(rendered.html).toContain('href="https://eypi.cc/login"')
    expect(rendered.text).toContain('Join Eypi.cc by registering today')
  })
})

describe('deliverFramePreviewEmail', () => {
  beforeEach(() => send.mockReset())

  it('sends from invites@eypi.cc with the png attached', async () => {
    send.mockResolvedValue({ error: null })

    const ok = await deliverFramePreviewEmail({
      apiKey: 'key',
      to: 'a@b.co',
      campaignTitle: 'Orientation',
      png: new Uint8Array([1, 2, 3]),
    })

    expect(ok).toBe(true)
    const arg = send.mock.calls[0]![0]
    expect(arg.from).toBe('Eypi <invites@eypi.cc>')
    expect(arg.to).toBe('a@b.co')
    expect(arg.attachments[0].filename).toBe('eypi-preview.png')
  })

  it('returns false when Resend rejects or throws', async () => {
    send.mockResolvedValueOnce({ error: { message: 'no' } })
    expect(await deliverFramePreviewEmail({ apiKey: 'k', to: 'a@b.co', campaignTitle: 'T', png: new Uint8Array([1]) })).toBe(false)
    send.mockRejectedValueOnce(new Error('boom'))
    expect(await deliverFramePreviewEmail({ apiKey: 'k', to: 'a@b.co', campaignTitle: 'T', png: new Uint8Array([1]) })).toBe(false)
  })
})

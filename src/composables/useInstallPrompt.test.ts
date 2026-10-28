// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Outcome = 'accepted' | 'dismissed'

function promptEvent(outcome: Outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: Outcome }>
  }
  event.prompt = vi.fn(async () => undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

async function load() {
  vi.resetModules()
  return (await import('./useInstallPrompt')).useInstallPrompt()
}

describe('useInstallPrompt', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.restoreAllMocks())

  it('cannot install until beforeinstallprompt fires', async () => {
    const { canInstall } = await load()
    expect(canInstall.value).toBe(false)
    window.dispatchEvent(promptEvent())
    expect(canInstall.value).toBe(true)
  })

  it('adopts an event stashed by the entry before this module loaded', async () => {
    const event = promptEvent()
    ;(window as { __bip?: Event }).__bip = event
    const { canInstall, install } = await load()
    delete (window as { __bip?: Event }).__bip
    expect(canInstall.value).toBe(true)
    await install()
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })

  it('prevents the default mini-infobar', async () => {
    await load()
    const event = promptEvent()
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('install() calls prompt() and resolves with the user choice', async () => {
    const { canInstall, install } = await load()
    const event = promptEvent('accepted')
    window.dispatchEvent(event)
    await expect(install()).resolves.toBe('accepted')
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(canInstall.value).toBe(false)
  })

  it('reports a dismissed prompt and hides the entry (the event is single use)', async () => {
    const { canInstall, install } = await load()
    window.dispatchEvent(promptEvent('dismissed'))
    await expect(install()).resolves.toBe('dismissed')
    expect(canInstall.value).toBe(false)
  })

  it('hides after appinstalled', async () => {
    const { canInstall } = await load()
    window.dispatchEvent(promptEvent())
    window.dispatchEvent(new Event('appinstalled'))
    expect(canInstall.value).toBe(false)
  })

  it('resolves dismissed when there is nothing to prompt', async () => {
    const { install } = await load()
    await expect(install()).resolves.toBe('dismissed')
  })
})

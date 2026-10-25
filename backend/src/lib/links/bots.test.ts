import { describe, expect, it } from 'vitest'
import { isBot } from './bots'

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

describe('isBot', () => {
  it('matches a Discord preview bot and ignores a normal Chrome browser', () => {
    expect(isBot('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe(true)
    expect(isBot(CHROME_UA)).toBe(false)
  })

  it('matches preview clients whose names do not contain bot', () => {
    expect(isBot('WhatsApp/2.23.20.0')).toBe(true)
    expect(isBot('facebookexternalhit/1.1')).toBe(true)
  })
})

import type { Client } from '@libsql/client/web'

const REFERRER_MAP: Record<string, string> = {
  // Own properties
  localhost: 'Localhost',
  'eypi.cc': 'Eypi',
  // Facebook
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'lm.facebook.com': 'Facebook',
  'fb.me': 'Facebook',
  'fb.com': 'Facebook',
  'web.facebook.com': 'Facebook',
  // Instagram
  'instagram.com': 'Instagram',
  'l.instagram.com': 'Instagram',
  // Twitter / X
  'twitter.com': 'Twitter / X',
  'x.com': 'Twitter / X',
  't.co': 'Twitter / X',
  // TikTok
  'tiktok.com': 'TikTok',
  'vm.tiktok.com': 'TikTok',
  'vt.tiktok.com': 'TikTok',
  // YouTube
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'm.youtube.com': 'YouTube',
  // Reddit
  'reddit.com': 'Reddit',
  'redd.it': 'Reddit',
  'old.reddit.com': 'Reddit',
  // LinkedIn
  'linkedin.com': 'LinkedIn',
  'lnkd.in': 'LinkedIn',
  // Pinterest
  'pinterest.com': 'Pinterest',
  'pin.it': 'Pinterest',
  'pinterest.ph': 'Pinterest',
  // Snapchat
  'snapchat.com': 'Snapchat',
  't.snapchat.com': 'Snapchat',
  // WhatsApp
  'whatsapp.com': 'WhatsApp',
  'wa.me': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  // Telegram
  'telegram.org': 'Telegram',
  't.me': 'Telegram',
  'web.telegram.org': 'Telegram',
  // Discord
  'discord.com': 'Discord',
  'discord.gg': 'Discord',
  'ptb.discord.com': 'Discord',
  // Threads
  'threads.net': 'Threads',
  'l.threads.net': 'Threads',
  // Google
  'google.com': 'Google',
  'google.com.ph': 'Google',
  'google.co': 'Google',
  // Gmail
  'mail.google.com': 'Gmail',
  // Viber
  'viber.com': 'Viber',
  // Twitch
  'twitch.tv': 'Twitch',
  // GitHub
  'github.com': 'GitHub',
  // Medium
  'medium.com': 'Medium',
  // Substack
  'substack.com': 'Substack',
  // Notion
  'notion.so': 'Notion',
  'notion.site': 'Notion',
  // Bereal
  'bere.al': 'BeReal',
  'bereal.com': 'BeReal',
}

export function sanitizeReferrer(raw: string | undefined): string {
  if (!raw) return 'Direct'
  try {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const hostname = new URL(url).hostname.toLowerCase()
    if (REFERRER_MAP[hostname]) return REFERRER_MAP[hostname]
    const withoutWww = hostname.replace(/^www\./, '')
    if (REFERRER_MAP[withoutWww]) return REFERRER_MAP[withoutWww]
    if (withoutWww.startsWith('localhost')) return 'Localhost'
    return withoutWww || 'Direct'
  } catch {
    return 'Direct'
  }
}

export function getOS(userAgent: string | null): string {
  if (!userAgent) return 'Unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('win')) return 'Windows'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS'
  if (ua.includes('mac')) return 'macOS'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('linux')) return 'Linux'
  return 'Unknown'
}

export type LinkClickMetadata = {
  linkId: string
  slug: string
  userAgent: string | null
  referrer: string
  country: string
}

export async function logLinkClick(db: Client, meta: LinkClickMetadata): Promise<void> {
  const os = getOS(meta.userAgent)
  await Promise.all([
    db.execute({
      sql: 'INSERT INTO analytics (link_id, os, country, referrer) VALUES (?, ?, ?, ?)',
      args: [meta.linkId, os, meta.country, meta.referrer],
    }),
    db.execute({
      sql: 'UPDATE links SET clicks = COALESCE(clicks, 0) + 1 WHERE slug = ?',
      args: [meta.slug],
    }),
  ])
}

const BOT_MARKERS = [
  'bot',
  'crawler',
  'spider',
  'facebookexternalhit',
  'Discordbot',
  'WhatsApp',
  'Slackbot',
  'Twitterbot',
  'TelegramBot',
  'LinkedInBot',
  'SkypeUriPreview',
  'Googlebot',
  'bingbot',
  'preview',
]

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_MARKERS.some((marker) => ua.includes(marker.toLowerCase()))
}

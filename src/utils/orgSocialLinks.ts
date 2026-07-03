import type { OrgSocialLinks } from '@/types/orgs'

const SOCIAL_BASES: Record<Exclude<keyof OrgSocialLinks, 'website'>, string> = {
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/',
  twitter: 'https://x.com/',
  linkedin: 'https://linkedin.com/company/',
  github: 'https://github.com/',
}

function stripAt(value: string): string {
  return value.trim().replace(/^@+/, '')
}

/** Extract a username/handle from a stored URL or return the raw handle. */
export function urlToSocialHandle(url: string, platform: keyof OrgSocialLinks): string {
  const raw = url.trim()
  if (!raw) return ''

  if (platform === 'website') {
    return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  }

  const base = SOCIAL_BASES[platform]
  const lower = raw.toLowerCase()
  if (lower.startsWith(base)) {
    return stripAt(raw.slice(base.length).split(/[/?#]/)[0] ?? '')
  }

  // Legacy full URLs with alternate hosts
  const patterns: Record<Exclude<keyof OrgSocialLinks, 'website'>, RegExp> = {
    facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([^/?#]+)/i,
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([^/?#]+)/i,
    linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\/([^/?#]+)/i,
    github: /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i,
  }
  const match = raw.match(patterns[platform])
  if (match?.[1]) return stripAt(match[1])

  return stripAt(raw)
}

/** Build a full URL from a username/handle for storage and public links. */
export function socialHandleToUrl(handle: string, platform: keyof OrgSocialLinks): string {
  const h = stripAt(handle)
  if (!h) return ''

  if (platform === 'website') {
    if (/^https?:\/\//i.test(h)) return h
    return `https://${h}`
  }

  return `${SOCIAL_BASES[platform]}${h}`
}

export function socialLinksToHandles(links: OrgSocialLinks): Required<OrgSocialLinks> {
  return {
    website: urlToSocialHandle(links.website ?? '', 'website'),
    facebook: urlToSocialHandle(links.facebook ?? '', 'facebook'),
    instagram: urlToSocialHandle(links.instagram ?? '', 'instagram'),
    twitter: urlToSocialHandle(links.twitter ?? '', 'twitter'),
    linkedin: urlToSocialHandle(links.linkedin ?? '', 'linkedin'),
    github: urlToSocialHandle(links.github ?? '', 'github'),
  }
}

export function socialHandlesToUrls(handles: OrgSocialLinks): Required<OrgSocialLinks> {
  return {
    website: socialHandleToUrl(handles.website ?? '', 'website'),
    facebook: socialHandleToUrl(handles.facebook ?? '', 'facebook'),
    instagram: socialHandleToUrl(handles.instagram ?? '', 'instagram'),
    twitter: socialHandleToUrl(handles.twitter ?? '', 'twitter'),
    linkedin: socialHandleToUrl(handles.linkedin ?? '', 'linkedin'),
    github: socialHandleToUrl(handles.github ?? '', 'github'),
  }
}

export const SOCIAL_FIELD_META: {
  key: keyof OrgSocialLinks
  label: string
  placeholder: string
  prefix?: string
}[] = [
  { key: 'website', label: 'Website', placeholder: 'jpcs.apc.edu.ph' },
  { key: 'facebook', label: 'Facebook', placeholder: 'jpcs.apc', prefix: 'facebook.com/' },
  { key: 'instagram', label: 'Instagram', placeholder: 'jpcs.apc', prefix: 'instagram.com/' },
  { key: 'twitter', label: 'X', placeholder: 'jpcs_apc', prefix: 'x.com/' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'jpcs.apc', prefix: 'linkedin.com/company/' },
  { key: 'github', label: 'GitHub', placeholder: 'jpcs-apc', prefix: 'github.com/' },
]

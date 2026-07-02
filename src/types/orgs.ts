export interface PublicOrgCatalogItem {
  slug: string
  name: string
  tagline: string | null
  logoUrl: string | null
}

export interface OrgSocialLinks {
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string
  linkedin?: string
  github?: string
}

export interface PublicOrgProfile {
  slug: string
  name: string
  tagline: string | null
  aboutMarkdown: string | null
  bannerUrl: string | null
  logoUrl: string | null
  socialLinks: OrgSocialLinks
}

export interface OrgProfileSettings extends PublicOrgProfile {
  isPublicCatalog: boolean
}

export interface PublicOrgEvent {
  slug: string
  name: string
  eventDate: string
  eventTime: string
  location: string
}

export interface PublicOrgProfileResponse {
  org: PublicOrgProfile
  events: {
    upcoming: PublicOrgEvent[]
    past: PublicOrgEvent[]
  }
}

export interface OrgListItem {
  org_id: string
  org_name: string
  logo_url?: string | null
  owner_id: string
  is_owner: number
  is_public_catalog?: number
  created_at: string
}

/** Organization slug (organizations.id). */
export function orgSlug(org: Pick<OrgListItem, 'org_id'>): string {
  return org.org_id
}

export const EMPTY_SOCIAL_LINKS: Required<OrgSocialLinks> = {
  website: '',
  facebook: '',
  instagram: '',
  twitter: '',
  linkedin: '',
  github: '',
}

export function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

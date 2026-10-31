import { useToast } from '@/composables/useToast'

/** Copy `https://eypi.cc/{slug}` and toast success or failure. Never throws. */
export async function copyShortLink(slug: string): Promise<void> {
  const toast = useToast()
  try {
    await navigator.clipboard.writeText(`https://eypi.cc/${slug}`)
    toast.success('Link copied.')
  } catch {
    toast.error('Could not copy the link.')
  }
}

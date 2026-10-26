import { isChunkLoadError } from '@/lib/chunkReload'
import { useToast } from '@/composables/useToast'

export function reportClientError(err: unknown, info?: string): void {
  const message = err instanceof Error ? err.message : 'Unknown client error'
  console.error(JSON.stringify({
    level: 'error',
    message,
    ...(info ? { info } : {}),
  }))
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError) || isChunkLoadError(err)) return false
  return /failed to fetch|networkerror|load failed|network request failed/i.test(err.message)
}

export function handleClientError(err: unknown, info?: string): void {
  reportClientError(err, info)
  if (isChunkLoadError(err)) return
  const toast = useToast()
  if (isNetworkError(err)) {
    toast.error("Can't reach eypi.cc. Check your connection.")
    return
  }
  if (err instanceof Error && err.name === 'ApiError') {
    toast.error(err.message)
    return
  }
  toast.error('Something went wrong. Refresh the page and try again.')
}

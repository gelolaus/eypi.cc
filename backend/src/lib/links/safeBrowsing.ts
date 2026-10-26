export const SAFE_BROWSING_TIMEOUT_MS = 1500
export const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find'

const THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
] as const

export type SafeBrowsingOutcome =
  | { outcome: 'skip' | 'clean' }
  | { outcome: 'unsafe' }
  | { outcome: 'fail_open'; error: unknown }

function matchList(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object' || !('matches' in payload)) return null
  const matches = payload.matches
  return Array.isArray(matches) ? matches : null
}

/** Lookup a destination. An unset key skips the call. Callers fail open on `fail_open`. */
export async function checkSafeBrowsing(
  url: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<SafeBrowsingOutcome> {
  const key = apiKey?.trim() ?? ''
  if (!key) return { outcome: 'skip' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SAFE_BROWSING_TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${SAFE_BROWSING_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'eypi.cc', clientVersion: '1' },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      return { outcome: 'fail_open', error: new Error(`Safe Browsing HTTP ${response.status}`) }
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      return { outcome: 'fail_open', error }
    }
    const matches = matchList(payload)
    if (matches && matches.length > 0) return { outcome: 'unsafe' }
    return { outcome: 'clean' }
  } catch (error) {
    return { outcome: 'fail_open', error }
  } finally {
    clearTimeout(timer)
  }
}

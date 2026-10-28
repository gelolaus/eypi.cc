import { API_BASE_URL } from '@/config/api'

/** Fire-and-forget module event. Counts only; sends no identifier (the server hashes the visitor). */
export function sendModuleBeacon(module: 'frames' | 'org', subjectId: string, action: string): void {
  if (!import.meta.env.PROD) return
  try {
    const url = `${API_BASE_URL}/api/beacon`
    const body = JSON.stringify({ module, subjectId, action })
    if (navigator.sendBeacon?.(url, body)) return
    void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(() => {})
  } catch { /* analytics must never break the page */ }
}

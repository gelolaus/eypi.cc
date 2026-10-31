import { ref, type Ref } from 'vue'
import type { TrendRange } from '@/lib/queries'

const STORAGE_KEY = 'eypi.dashboardRange'
const ALLOWED = new Set<TrendRange>([7, 30, 90])

function readRange(): TrendRange {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const n = Number(raw) as TrendRange
    if (ALLOWED.has(n)) return n
  } catch {
    // Fall back to the default when storage is unavailable.
  }
  return 30
}

const range = ref<TrendRange>(readRange())

export function useDashboardRange(): { range: Ref<TrendRange>; setRange: (value: TrendRange) => void } {
  function setRange(value: TrendRange) {
    if (!ALLOWED.has(value)) return
    range.value = value
    try {
      sessionStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // The choice still applies for this visit when storage is unavailable.
    }
  }

  return { range, setRange }
}
import { useToast } from '@/composables/useToast'

export interface UndoOptions {
  /** Shown in the toast. */
  message: string
  /** Optimistic UI change; runs immediately. */
  apply: () => void
  /** Puts the UI back; runs on Undo or when the commit fails. */
  revert: () => void
  /**
   * The real request. Runs once, after the window or when the page is hidden.
   * Capture anything it needs (ids, slugs, org header) when the action starts, not when it runs.
   * Throw an Error with a readable message to have it shown in the failure toast.
   */
  commit: () => Promise<void>
  windowMs?: number
}

type Entry = { flush: () => void }

const pending = new Set<Entry>()
let listening = false

function flushAll() {
  for (const entry of [...pending]) entry.flush()
}

function listen() {
  if (listening) return
  listening = true
  // A hidden or closing page may never run the timer, so commit now. Commits
  // should pass { keepalive: true } to api so the request outlives the page.
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}

/** Headers that pin a deferred request to the org that was active when the action started. */
export function activeOrgHeaders(): Record<string, string> {
  const id = activeOrgId()
  return id ? { 'X-Active-Org-Id': id } : {}
}

/** Id of the org that is active right now, or '' when none. */
export function activeOrgId(): string {
  try {
    return localStorage.getItem('active_org_id') ?? ''
  } catch {
    return ''
  }
}

/** Puts one removed row back after the row that preceded it, without disturbing other rows. */
export function reinsert<T>(list: T[], item: T, prevKey: string | undefined, keyOf: (row: T) => string): T[] {
  const key = keyOf(item)
  if (list.some((row) => keyOf(row) === key)) return list
  const next = list.slice()
  const at = prevKey === undefined ? -1 : next.findIndex((row) => keyOf(row) === prevKey)
  next.splice(at + 1, 0, item)
  return next
}

/** Key of the row just before `key`, so a later revert can reinsert in place. */
export function previousKey<T>(list: T[], key: string, keyOf: (row: T) => string): string | undefined {
  const at = list.findIndex((row) => keyOf(row) === key)
  return at > 0 ? keyOf(list[at - 1]) : undefined
}

/** Optimistic action: apply now, commit after the window unless the user taps Undo. */
export function runWithUndo(opts: UndoOptions): void {
  const { message, apply, revert, commit, windowMs = 5000 } = opts
  const toast = useToast()
  let settled = false
  let toastId = -1
  let left = windowMs
  let startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined

  const entry: Entry = {
    flush() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pending.delete(entry)
      toast.dismiss(toastId)
      commit().catch((err: unknown) => {
        revert()
        const detail = err instanceof Error && err.message ? err.message : ''
        toast.error('That did not go through. It was restored.', detail ? { detail } : undefined)
      })
    },
  }

  const start = () => {
    startedAt = Date.now()
    timer = setTimeout(entry.flush, left)
  }

  listen()
  apply()
  pending.add(entry)
  toastId = toast.info(message, {
    duration: windowMs,
    action: {
      label: 'Undo',
      onClick() {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pending.delete(entry)
        revert()
      },
    },
    // Closing the toast any other way (Escape, swipe, timer) accepts the action.
    onDismiss: entry.flush,
    // Hover and focus hold the toast, so they hold the commit too.
    onPause() {
      if (settled) return
      clearTimeout(timer)
      left = Math.max(0, left - (Date.now() - startedAt))
    },
    onResume() {
      if (!settled) start()
    },
  })
  start()
}

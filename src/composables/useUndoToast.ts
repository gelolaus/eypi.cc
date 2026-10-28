import { useToast } from '@/composables/useToast'

export interface UndoOptions {
  /** Shown in the toast. */
  message: string
  /** Optimistic UI change; runs immediately. */
  apply: () => void
  /** Puts the UI back; runs on Undo or when the commit fails. */
  revert: () => void
  /** The real request. Runs once, after the window or when the page is hidden. */
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
  window.addEventListener('beforeunload', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}

/** Optimistic action: apply now, commit after the window unless the user taps Undo. */
export function runWithUndo(opts: UndoOptions): void {
  const { message, apply, revert, commit, windowMs = 5000 } = opts
  const toast = useToast()
  let settled = false
  let toastId = -1


  const entry: Entry = {
    flush() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pending.delete(entry)
      toast.dismiss(toastId)
      commit().catch(() => {
        revert()
        toast.error('That did not go through. It was restored.')
      })
    },
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
  })
  const timer = setTimeout(entry.flush, windowMs)
}

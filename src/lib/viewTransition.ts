type Transition = { skipTransition(): void; ready: Promise<unknown>; finished: Promise<unknown>; updateCallbackDone: Promise<unknown> }
type Doc = { startViewTransition?: (cb: () => Promise<void>) => Transition }

let running: Transition | undefined

// Runs a DOM update inside a view transition when the browser supports it and
// the user allows motion. Resolves when the update is done, never when the
// animation ends, and rejects with the update's own error.
export async function withViewTransition(update: () => Promise<void> | void): Promise<void> {
  const doc = document as Doc
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduce) return update()
  running?.skipTransition()
  await new Promise<void>((resolve, reject) => {
    const t = doc.startViewTransition!(async () => {
      try { await update(); resolve() } catch (e) { reject(e) }
    })
    running = t
    // A skipped or failed animation is not an error for the caller; skipping a finished one is a no-op.
    for (const p of [t.ready, t.finished, t.updateCallbackDone]) p.catch(() => {})
  })
}

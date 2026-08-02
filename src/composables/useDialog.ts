import { ref, shallowRef } from 'vue'

export type DialogKind = 'info' | 'confirm'

export interface InfoDialogOptions {
  title: string
  body: string
  confirmLabel?: string
}

export interface ConfirmDialogOptions {
  title: string
  body: string
  confirmLabel?: string
  abortLabel?: string
  /** Exact string the user must type before confirm is enabled. */
  requireText?: string
}

export interface DialogState {
  id: number
  kind: DialogKind
  title: string
  body: string
  confirmLabel: string
  abortLabel: string
  requireText?: string
  resolve: (value: boolean) => void
}

type DialogEnqueue = Omit<DialogState, 'id' | 'resolve'>

/** Exact match gate used by DialogHost before enabling confirm. */
export function matchesRequireText(typed: string, requireText?: string): boolean {
  if (!requireText) return true
  return typed === requireText
}

const current = shallowRef<DialogState | null>(null)
const queue = ref<DialogState[]>([])
let nextId = 0

function pump() {
  if (current.value || queue.value.length === 0) return
  current.value = queue.value.shift() ?? null
}

function enqueue(partial: DialogEnqueue): Promise<boolean> {
  return new Promise((resolve) => {
    queue.value.push({
      ...partial,
      id: nextId++,
      resolve,
    })
    pump()
  })
}

function close(result: boolean) {
  const active = current.value
  if (!active) return
  current.value = null
  active.resolve(result)
  pump()
}

export function useDialog() {
  return {
    current,
    info(opts: InfoDialogOptions): Promise<void> {
      return enqueue({
        kind: 'info',
        title: opts.title,
        body: opts.body,
        confirmLabel: opts.confirmLabel ?? 'Got it',
        abortLabel: 'Got it',
      }).then(() => undefined)
    },
    confirm(opts: ConfirmDialogOptions): Promise<boolean> {
      return enqueue({
        kind: 'confirm',
        title: opts.title,
        body: opts.body,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        abortLabel: opts.abortLabel ?? 'Abort',
        requireText: opts.requireText,
      })
    },
    confirmAction: () => close(true),
    abort: () => close(false),
  }
}

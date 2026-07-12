import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
  detail?: string
  duration?: number
}

export interface Toast {
  id: number
  message: string
  detail?: string
  type: ToastType
  duration: number
}

const MAX_TOASTS = 3
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
}

const toasts = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const remaining = new Map<number, number>()
const startedAt = new Map<number, number>()
let nextId = 0

function clearTimer(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

function scheduleRemove(id: number, ms: number) {
  clearTimer(id)
  remaining.set(id, ms)
  startedAt.set(id, Date.now())
  timers.set(
    id,
    setTimeout(() => {
      removeToast(id)
    }, ms),
  )
}

function removeToast(id: number) {
  clearTimer(id)
  remaining.delete(id)
  startedAt.delete(id)
  const index = toasts.value.findIndex((t) => t.id === id)
  if (index > -1) toasts.value.splice(index, 1)
}

function pauseToast(id: number) {
  const timer = timers.get(id)
  if (!timer) return
  const started = startedAt.get(id)
  const left = remaining.get(id)
  if (started == null || left == null) return
  const elapsed = Date.now() - started
  remaining.set(id, Math.max(0, left - elapsed))
  clearTimer(id)
}

function resumeToast(id: number) {
  if (timers.has(id)) return
  const left = remaining.get(id)
  if (left == null) return
  if (left <= 0) {
    removeToast(id)
    return
  }
  scheduleRemove(id, left)
}

function resolveDuration(
  type: ToastType,
  second?: number | ToastOptions,
): { detail?: string; duration: number } {
  if (typeof second === 'number') {
    return { duration: second }
  }
  return {
    detail: second?.detail,
    duration: second?.duration ?? DEFAULT_DURATION[type],
  }
}

function addToast(message: string, type: ToastType, second?: number | ToastOptions) {
  const { detail, duration } = resolveDuration(type, second)

  const existing = toasts.value.find((t) => t.type === type && t.message === message && t.detail === detail)
  if (existing) {
    scheduleRemove(existing.id, duration)
    existing.duration = duration
    return existing.id
  }

  while (toasts.value.length >= MAX_TOASTS) {
    const oldest = toasts.value[0]
    if (oldest) removeToast(oldest.id)
  }

  const id = nextId++
  toasts.value.push({ id, message, detail, type, duration })
  scheduleRemove(id, duration)
  return id
}

export function useToast() {
  return {
    toasts,
    dismiss: removeToast,
    pause: pauseToast,
    resume: resumeToast,
    success: (msg: string, second?: number | ToastOptions) => addToast(msg, 'success', second),
    error: (msg: string, second?: number | ToastOptions) => addToast(msg, 'error', second),
    info: (msg: string, second?: number | ToastOptions) => addToast(msg, 'info', second),
  }
}

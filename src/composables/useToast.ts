import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  const addToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => removeToast(id), duration)
  }

  const removeToast = (id: number) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) toasts.value.splice(index, 1)
  }

  return {
    toasts,
    success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
    error: (msg: string, dur?: number) => addToast(msg, 'error', dur),
    info: (msg: string, dur?: number) => addToast(msg, 'info', dur)
  }
}

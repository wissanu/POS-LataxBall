import { reactive } from 'vue'

export const toasts = reactive([])
let seq = 0

export function useToast() {
  const push = (message, tone = 'info', ms = 3200) => {
    const id = ++seq
    toasts.push({ id, message, tone })
    setTimeout(() => {
      const i = toasts.findIndex((t) => t.id === id)
      if (i !== -1) toasts.splice(i, 1)
    }, ms)
  }
  return {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error', 4500),
    info: (m) => push(m, 'info'),
  }
}

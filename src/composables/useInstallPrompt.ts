import { ref } from 'vue'

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module level so the event is kept even if it fires before a menu mounts.
const saved = ref<InstallEvent | null>(null)
const canInstall = ref(false)

if (typeof window !== 'undefined') {
  const early = (window as { __bip?: Event }).__bip
  if (early) {
    saved.value = early as InstallEvent
    canInstall.value = true
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    saved.value = e as InstallEvent
    canInstall.value = true
  })
  window.addEventListener('appinstalled', () => {
    saved.value = null
    canInstall.value = false
  })
}

async function install(): Promise<'accepted' | 'dismissed'> {
  const event = saved.value
  if (!event) return 'dismissed'
  saved.value = null
  canInstall.value = false
  await event.prompt()
  return (await event.userChoice).outcome
}

export function useInstallPrompt() {
  return { canInstall, install }
}

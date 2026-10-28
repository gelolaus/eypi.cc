import { DOOR_SLUGS_KEY } from '@/lib/tix/doorStoreKeys'

/**
 * Door devices keep the guest list (names and QR tokens) in IndexedDB.
 * - `logout`: the person chose to sign out. Guest lists go; check-ins not yet sent stay (ids and times only).
 * - `account`: a different person signed in on this device. Everything goes.
 * A session that merely expires keeps everything, so a door device can finish syncing after signing in again.
 * Stays tiny: the store is a lazy chunk, loaded only if a door store was ever created on this device.
 */
export async function clearDoorData(mode: 'logout' | 'account'): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') return
    let any = true
    try { any = localStorage.getItem(DOOR_SLUGS_KEY) !== null } catch { /* unknown, so check */ }
    if (!any) return
    const { wipeDoorStores } = await import('@/lib/tix/doorStore')
    await wipeDoorStores(mode === 'account' ? 'all' : 'logout')
  } catch { /* offline data cleanup is best effort */ }
}

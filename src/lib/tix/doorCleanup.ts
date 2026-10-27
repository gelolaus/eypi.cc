import { DOOR_SLUGS_KEY } from '@/lib/tix/doorStoreKeys'

/**
 * Door devices keep the guest list (names and QR tokens) in IndexedDB. It must not outlive the
 * session, so sign-out and account switches wipe it. Stays tiny: the store itself is a lazy chunk,
 * loaded here only when a door store was ever created on this device.
 */
export async function clearDoorData(options: { keepUnsynced?: boolean } = { keepUnsynced: true }): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') return
    let any = true
    try { any = localStorage.getItem(DOOR_SLUGS_KEY) !== null } catch { /* unknown, so check */ }
    if (!any) return
    const { deleteAllDoorStores } = await import('@/lib/tix/doorStore')
    await deleteAllDoorStores(options)
  } catch { /* offline data cleanup is best effort */ }
}

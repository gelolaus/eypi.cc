import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { attendeeQrFileName, downloadAttendeeQr, downloadAttendeeQrZip } from '@/lib/tix/qrFiles'

export interface AttendeeRow {
  id: string
  first_name: string
  last_name: string
  email: string
  status: string | null
  actioned_at: string | null
  cluster_value: string | null
  qr_token: string
}

export function isPendingStatus(status: string | null | undefined): boolean {
  return !status || status === 'not_checked_in'
}

function qrIdentity(attendee: AttendeeRow) {
  return {
    id: attendee.id,
    firstName: attendee.first_name ?? '',
    lastName: attendee.last_name ?? '',
    qrToken: attendee.qr_token,
  }
}

function isApcAttendee(attendee: AttendeeRow): boolean {
  const cluster = (attendee.cluster_value ?? '').toLowerCase()
  return cluster.includes('asia pacific college') || cluster.includes('jpcs')
}

export function useEventAttendees(slug: string) {
  const toast = useToast()
  const attendees = ref<AttendeeRow[]>([])
  const loadingAttendees = ref(true)
  const actionPending = ref('')
  const exportingXlsx = ref(false)
  const downloadingZip = ref(false)

  const activeAttendeeCount = computed(() => attendees.value.filter((attendee) => attendee.status !== 'removed').length)

  async function fetchAttendees() {
    loadingAttendees.value = true
    try {
      const res = await api.raw(`/api/events/${slug}/attendees`)
      const data = await res.json() as { message?: string; attendees?: AttendeeRow[] }
      if (!res.ok) throw new Error(data.message ?? 'Failed to load attendees.')
      attendees.value = data.attendees ?? []
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load attendees.')
    } finally {
      loadingAttendees.value = false
    }
  }

  async function doAction(action: string, attendeeId: string) {
    actionPending.value = action
    try {
      const res = await api.raw(`/api/events/${slug}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ attendeeId }),
      })
      const data = await res.json() as { message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Action failed.')
      toast.success(data.message ?? 'Updated.')
      await fetchAttendees()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      actionPending.value = ''
    }
  }

  async function saveCluster(id: string, clusterValue: string | null) {
    const res = await api.raw(`/api/events/${slug}/attendees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ clusterValue }),
    })
    if (!res.ok) {
      const data = await res.json() as { message?: string }
      throw new Error(data.message ?? 'Failed.')
    }
    const row = attendees.value.find((attendee) => attendee.id === id)
    if (row) row.cluster_value = clusterValue
  }

  async function downloadQr(attendee: AttendeeRow) {
    if (!attendee.qr_token) {
      toast.error('This attendee has no QR code.')
      return
    }
    try {
      await downloadAttendeeQr(qrIdentity(attendee))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not download the QR code.')
    }
  }

  async function downloadAllZip() {
    const rows = attendees.value.filter((attendee) => attendee.qr_token)
    if (!rows.length || downloadingZip.value) return
    downloadingZip.value = true
    try {
      await downloadAttendeeQrZip(slug, rows.map(qrIdentity))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not build the ZIP.')
    } finally {
      downloadingZip.value = false
    }
  }

  async function exportToXlsx() {
    if (!attendees.value.length) return
    exportingXlsx.value = true
    try {
      const XLSX = await import('xlsx')
      const toRow = (attendee: AttendeeRow) => ({
        'First Name': (attendee.first_name ?? '').trim(),
        'Last Name': (attendee.last_name ?? '').trim(),
        'Email Address': (attendee.email ?? '').trim(),
        Cluster: (attendee.cluster_value ?? '').trim(),
        'QR Code File Name': attendeeQrFileName(qrIdentity(attendee)),
      })
      const active = attendees.value.filter((attendee) => attendee.status !== 'removed')
      const apc = active.filter((attendee) => isApcAttendee(attendee)).map(toRow)
      const nonApc = active.filter((attendee) => !isApcAttendee(attendee)).map(toRow)

      const workbookApc = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbookApc, XLSX.utils.json_to_sheet(apc), 'APC Attendees')
      XLSX.writeFile(workbookApc, `${slug}-attendees-apc.xlsx`)

      const workbookOther = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbookOther, XLSX.utils.json_to_sheet(nonApc), 'Other Attendees')
      XLSX.writeFile(workbookOther, `${slug}-attendees-non-apc.xlsx`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      exportingXlsx.value = false
    }
  }

  return {
    attendees,
    loadingAttendees,
    actionPending,
    exportingXlsx,
    downloadingZip,
    activeAttendeeCount,
    fetchAttendees,
    saveCluster,
    downloadQr,
    downloadAllZip,
    exportToXlsx,
    checkIn: (attendeeId: string) => doAction('checkin-manual', attendeeId),
    checkOut: (attendeeId: string) => doAction('checkout', attendeeId),
    removeAttendee: (attendeeId: string) => doAction('remove', attendeeId),
    restoreAttendee: (attendeeId: string) => doAction('restore', attendeeId),
  }
}

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

async function downloadAttendeeWorkbook(
  filename: string,
  sheetName: string,
  rows: { firstName: string; lastName: string; email: string; cluster: string; qr: string }[],
) {
  const exceljs = await import('exceljs')
  const workbook = new exceljs.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = [
    { header: 'First Name', key: 'firstName' },
    { header: 'Last Name', key: 'lastName' },
    { header: 'Email Address', key: 'email' },
    { header: 'Cluster', key: 'cluster' },
    { header: 'QR Code File Name', key: 'qr' },
  ]
  for (const row of rows) sheet.addRow(row)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
      const toRow = (attendee: AttendeeRow) => ({
        firstName: (attendee.first_name ?? '').trim(),
        lastName: (attendee.last_name ?? '').trim(),
        email: (attendee.email ?? '').trim(),
        cluster: (attendee.cluster_value ?? '').trim(),
        qr: attendeeQrFileName(qrIdentity(attendee)),
      })
      const rows = attendees.value.filter((attendee) => attendee.status !== 'removed').map(toRow)
      await downloadAttendeeWorkbook(`${slug}-attendees.xlsx`, 'Attendees', rows)
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

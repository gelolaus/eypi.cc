// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/composables/useQrScanner', () => ({
  useQrScanner: () => ({
    videoRef: ref(null),
    scannerError: ref(''),
    scanStatus: ref('idle'),
    scanMessage: ref(''),
    cameraStarting: ref(false),
    needsCameraPrompt: ref(true),
    hudLabel: ref('Ready'),
    hudClass: ref(''),
    hudBannerClass: ref(''),
    onEnableCameraClick: vi.fn(),
    stopScanner: vi.fn(),
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { eventId: 'launch' }, query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('qr-code-styling', () => ({
  default: class {
    append(el: HTMLElement) { el.appendChild(document.createElement('canvas')) }
  },
}))

import AttendeeTable from '@/components/tix/AttendeeTable.vue'
import ClusterBars from '@/components/tix/ClusterBars.vue'
import ScannerPanel from '@/components/tix/ScannerPanel.vue'

import addGuest from '@/components/tix/AddGuestPanel.vue?raw'
import attendeeTable from '@/components/tix/AttendeeTable.vue?raw'
import clusterBars from '@/components/tix/ClusterBars.vue?raw'
import scannerPanel from '@/components/tix/ScannerPanel.vue?raw'
import clustersStep from '@/components/tix/selection/ClustersStep.vue?raw'
import confirmStep from '@/components/tix/selection/ConfirmStep.vue?raw'
import criteriaStep from '@/components/tix/selection/CriteriaStep.vue?raw'
import guaranteeStep from '@/components/tix/selection/GuaranteeStep.vue?raw'
import mapStep from '@/components/tix/selection/MapColumnsStep.vue?raw'
import uploadStep from '@/components/tix/selection/UploadStep.vue?raw'
import selectionView from './AttendeeSelectionView.vue?raw'
import detailView from './EventDetailView.vue?raw'
import eventsView from './EventsView.vue?raw'
import eventBuilderView from './EventBuilderView.vue?raw'
import eventQuestionsEditor from '@/components/tix/EventQuestionsEditor.vue?raw'
import eventPublishDialog from '@/components/tix/EventPublishDialog.vue?raw'
import lotteryPanel from '@/components/tix/LotteryPanel.vue?raw'
import inboxView from './AttendeesInboxView.vue?raw'
import layoutView from './TixManageLayout.vue?raw'

const sources = {
  addGuest, attendeeTable, clusterBars, scannerPanel, clustersStep, confirmStep, criteriaStep,
  guaranteeStep, mapStep, uploadStep, selectionView, detailView, eventsView, eventBuilderView, eventQuestionsEditor, eventPublishDialog, lotteryPanel, inboxView, layoutView,
}

const attendee = { id: 'a', first_name: 'Ana', last_name: 'Santos', email: 'a@x.com', status: null, actioned_at: null, cluster_value: null, qr_token: 'qr' }

describe('tix restyle', () => {
  it.each(Object.entries(sources))('%s has no legacy classes or hard-coded colours', (_n, src) => {
    expect(src).not.toMatch(/(?<![a-z])g-(text|muted|border|accent|primary|surface)|mica|gold|tap-scale|apc-|btn-(primary|secondary|danger|gold)|\bcontrol\b|dark:(bg|text|border)-(slate|gray)|\bslate-\d|\bgray-\d|#[0-9a-fA-F]{3,8}\b|\breveal\b|text-data|text-card-title/)
  })

  it('attendee list scrolls inside an overflow-x-auto wrapper with the actions reachable', () => {
    const w = mount(AttendeeTable, {
      props: { attendees: [attendee], loading: false, actionPending: '', exporting: false, downloadingZip: false, tabFilter: null, tabLabel: 'All', clusters: [] },
    })
    const scroller = w.get('.overflow-x-auto')
    expect(scroller.find('[data-attendee-list]').exists()).toBe(true)
    expect(scroller.find('[data-attendee-row] [data-slot="button"]').exists()).toBe(true)
  })

  it('cluster bars colour their fill from the chart token', () => {
    const w = mount(ClusterBars, {
      props: { slug: 'ev', clusters: [{ id: 'c', value: 'A', maxCount: 10, currentCount: 5, remainingSlots: 5 }] },
    })
    expect(w.html()).toContain('var(--chart-1)')
  })

  it('scanner keeps an unstyled video and a start Button', () => {
    const w = mount(ScannerPanel, { props: { slug: 'ev' } })
    const video = w.get('video')
    expect(video.classes().join(' ')).not.toMatch(/filter|blur|opacity|mix-blend|grayscale|invert|sepia|brightness|contrast/)
    expect(video.attributes('style')).toBeUndefined()
    const start = w.get('[data-scanner-actions] [data-slot="button"]')
    expect(start.text()).toContain('Enable camera')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const destructiveViews = [
  './views/dp/DpCampaignsView.vue',
  './views/dp/DpEditCampaignView.vue',
  './views/links/LinksView.vue',
  './views/orgs/OrgModifyView.vue',
  './views/settings/OrgManagementEditView.vue',
  './views/tix/EventDetailView.vue',
  './views/tix/EventsView.vue',
]

const formGenerators = [
  './views/forms/generators/ConcessionaireView.vue',
  './views/forms/generators/LetterOfIntentView.vue',
  './views/forms/generators/VisitorsPassView.vue',
]

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('notification migration', () => {
  it('uses the shared dialog for destructive confirmations', () => {
    for (const path of destructiveViews) {
      const contents = source(path)
      expect(contents, path).not.toMatch(/\bwindow\.confirm\s*\(/)
      expect(contents, path).not.toMatch(/(?<![.\w])confirm\s*\(\s*[`'"]/)
      expect(contents, path).toContain('dialog.confirm')
      expect(contents, path).toContain('useDialog')
    }
  })

  it('removes the LinksView inline delete modal', () => {
    const contents = source('./views/links/LinksView.vue')
    expect(contents).not.toContain('isDeleteModalOpen')
    expect(contents).not.toContain('cancelDelete')
    expect(contents).not.toContain('Delete Confirmation Modal')
  })

  it('replaces form generator alerts with shared notifications', () => {
    for (const path of formGenerators) {
      const contents = source(path)
      expect(contents, path).not.toMatch(/\balert\s*\(/)
      expect(contents, path).toContain('useToast')
      expect(contents, path).toContain('useDialog')
    }
  })
})

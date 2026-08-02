import { afterEach, describe, expect, it } from 'vitest'
import { matchesRequireText, useDialog } from './useDialog'

afterEach(() => {
  const dialog = useDialog()
  while (dialog.current.value) {
    dialog.abort()
  }
})

describe('matchesRequireText', () => {
  it('is false until typed equals requireText', () => {
    expect(matchesRequireText('DEL', 'DELETE')).toBe(false)
    expect(matchesRequireText('delete', 'DELETE')).toBe(false)
    expect(matchesRequireText('DELETE', 'DELETE')).toBe(true)
  })

  it('is true when requireText is unset', () => {
    expect(matchesRequireText('anything')).toBe(true)
    expect(matchesRequireText('')).toBe(true)
  })
})

describe('useDialog confirm + requireText', () => {
  it('stores requireText on current and abort resolves false', async () => {
    const dialog = useDialog()
    const pending = dialog.confirm({
      title: 'Delete',
      body: 'Type to confirm',
      requireText: 'DELETE',
    })

    expect(dialog.current.value?.kind).toBe('confirm')
    expect(dialog.current.value?.requireText).toBe('DELETE')
    expect(matchesRequireText('', dialog.current.value?.requireText)).toBe(false)

    dialog.abort()
    await expect(pending).resolves.toBe(false)
  })

  it('confirmAction resolves true after match (UI gate uses matchesRequireText)', async () => {
    const dialog = useDialog()
    const pending = dialog.confirm({
      title: 'Delete',
      body: 'Type to confirm',
      requireText: 'DELETE',
    })

    expect(matchesRequireText('DELETE', dialog.current.value?.requireText)).toBe(true)
    dialog.confirmAction()
    await expect(pending).resolves.toBe(true)
  })
})

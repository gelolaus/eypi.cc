import { describe, expect, it, vi } from 'vitest'
import { buildCommands, filterCommands, type Command } from './commands'

const orgs = [
  { id: 'robotics', name: 'Robotics Club' },
  { id: 'debate', name: 'Debate Society' },
]

function ctx(over: Partial<Parameters<typeof buildCommands>[0]> & { hasOrg?: boolean } = {}) {
  const hasOrg = over.hasOrg ?? true
  return {
    role: 'user',
    orgs,
    activeOrgId: 'robotics',
    go: vi.fn(),
    switchOrg: vi.fn(),
    ...over,
    hasOrg,
  }
}

describe('buildCommands', () => {
  it('lists the app destinations with their real paths', () => {
    const go = vi.fn()
    const list = buildCommands(ctx({ go }))
    const labels = list.filter((command) => command.group === 'Go to').map((command) => command.label)
    expect(labels).toEqual([
      'Dashboard', 'Links', 'My tickets', 'Wallpaper', 'Invites', 'Orgs',
      'Tix', 'Frames', 'Forms', 'My org', 'Account',
    ])

    for (const [label, path] of [
      ['Dashboard', '/dashboard'],
      ['Links', '/links'],
      ['My tickets', '/tickets'],
      ['Wallpaper', '/wallpaper'],
      ['Invites', '/invites'],
      ['Orgs', '/orgs'],
      ['Tix', '/manage/tix'],
      ['Frames', '/manage/frames'],
      ['Forms', '/forms'],
      ['My org', '/orgs/modify'],
      ['Account', '/account'],
    ]) {
      list.find((command) => command.label === label)!.run()
      expect(go).toHaveBeenLastCalledWith(path)
    }
  })

  it('hides org-only destinations unless the user has an org', () => {
    const hidden = ['go:/manage/tix', 'go:/manage/frames', 'go:/forms', 'go:/orgs/modify']
    const shown = ['go:/wallpaper', 'go:/invites']

    const without = buildCommands(ctx({ hasOrg: false })).map((command) => command.id)
    for (const id of hidden) expect(without).not.toContain(id)
    for (const id of shown) expect(without).toContain(id)

    const withOrg = buildCommands(ctx({ hasOrg: true })).map((command) => command.id)
    for (const id of hidden) expect(withOrg).toContain(id)
    for (const id of shown) expect(withOrg).toContain(id)
  })

  it('hides admin commands from non-admins and shows them to admins', () => {
    expect(buildCommands(ctx()).map((command) => command.label)).not.toContain('Admin')
    const go = vi.fn()
    const admin = buildCommands(ctx({ role: 'admin', go }))
    expect(admin.map((command) => command.label)).toContain('Admin')
    const command = admin.find((entry) => entry.label === 'Admin')!
    expect(command.group).toBe('Go to')
    command.run()
    expect(go).toHaveBeenCalledWith('/admin/users')
  })

  it('creates a link by opening the Links page', () => {
    const go = vi.fn()
    const create = buildCommands(ctx({ go })).find((command) => command.label === 'Create a link')!
    expect(create.group).toBe('Create')
    create.run()
    expect(go).toHaveBeenCalledWith('/links')
  })

  it('offers a Switch org command for each of the user organizations', () => {
    const switches = buildCommands(ctx()).filter((command) => command.group === 'Switch org')
    expect(switches.map((command) => command.label)).toEqual(['Robotics Club', 'Debate Society'])
  })

  it('switches orgs through the shared switcher callback', () => {
    const switchOrg = vi.fn()
    const list = buildCommands(ctx({ switchOrg }))
    list.find((command) => command.label === 'Debate Society')!.run()
    expect(switchOrg).toHaveBeenCalledWith('debate')
  })

  it('marks the active organization and no-ops through the shared switcher', () => {
    const switchOrg = vi.fn()
    const list = buildCommands(ctx({ switchOrg }))
    const current = list.find((command) => command.label === 'Robotics Club')!
    expect(current.current).toBe(true)
    expect(list.find((command) => command.label === 'Debate Society')!.current).toBe(false)
    current.run()
    // selectOrg owns the no-op guard; the palette still calls the shared path.
    expect(switchOrg).toHaveBeenCalledWith('robotics')
  })

  it('has no Switch org group when the user has no organizations', () => {
    const list = buildCommands(ctx({ orgs: [], activeOrgId: null }))
    expect(list.some((command) => command.group === 'Switch org')).toBe(false)
    expect(list.length).toBeGreaterThan(0)
  })

  it('gives every command a unique id', () => {
    const ids = buildCommands(ctx({ role: 'admin' })).map((command) => command.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('filterCommands', () => {
  const list = buildCommands(ctx({ role: 'admin' }))

  it('returns every command for an empty query', () => {
    expect(filterCommands(list, '   ')).toEqual(list)
  })

  it('matches labels and keywords case-insensitively', () => {
    expect(filterCommands(list, 'DASH').map((command) => command.label)).toContain('Dashboard')
    expect(filterCommands(list, 'qr').map((command) => command.label)).toContain('Links')
    expect(filterCommands(list, 'club').map((command) => command.label)).toContain('Robotics Club')
  })

  it('ranks start-of-word matches before mid-word matches', () => {
    const commands: Command[] = [
      { id: 'a', label: 'Frames', group: 'Go to', keywords: [], run: () => {} },
      { id: 'b', label: 'My tickets', group: 'Go to', keywords: [], run: () => {} },
      { id: 'c', label: 'Tix', group: 'Go to', keywords: [], run: () => {} },
    ]
    // Tix starts with "ti"; My tickets only starts a later word with it. Frames is excluded.
    expect(filterCommands(commands, 'ti').map((command) => command.id)).toEqual(['c', 'b'])

    const mixed: Command[] = [
      { id: 'x', label: 'Settings', group: 'Go to', keywords: [], run: () => {} },
      { id: 'y', label: 'Tix', group: 'Go to', keywords: [], run: () => {} },
    ]
    // Tix starts with "t"; Settings only contains it.
    expect(filterCommands(mixed, 't').map((command) => command.id)).toEqual(['y', 'x'])
  })

  it('keeps the original order within the same rank', () => {
    const commands: Command[] = [
      { id: 'a', label: 'Alpha', group: 'Go to', keywords: [], run: () => {} },
      { id: 'b', label: 'Alpine', group: 'Go to', keywords: [], run: () => {} },
    ]
    expect(filterCommands(commands, 'al').map((command) => command.id)).toEqual(['a', 'b'])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterCommands(list, 'zzzz')).toEqual([])
  })
})

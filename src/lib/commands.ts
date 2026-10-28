export type CommandGroup = 'Go to' | 'Create' | 'Switch org'

export interface Command {
  id: string
  label: string
  group: CommandGroup
  keywords: string[]
  run: () => void
}

export interface CommandContext {
  role: string
  orgs: { id: string; name: string }[]
  activeOrgId: string | null
  /** Wired by the palette so a command can close the dialog before it navigates. */
  go?: (path: string) => void
  /** Wired by the palette to useActiveOrg().selectOrg, the same path as the org switcher. */
  switchOrg?: (orgId: string) => void
}

const DESTINATIONS: { label: string; to: string; keywords: string[] }[] = [
  { label: 'Dashboard', to: '/dashboard', keywords: ['home', 'overview'] },
  { label: 'Links', to: '/links', keywords: ['short', 'url', 'qr'] },
  { label: 'My tickets', to: '/tickets', keywords: ['ticket', 'passes', 'events'] },
  { label: 'Tix', to: '/manage/tix', keywords: ['ticketing', 'events', 'door'] },
  { label: 'Frames', to: '/manage/frames', keywords: ['profile', 'photo', 'frame'] },
  { label: 'Orgs', to: '/orgs', keywords: ['organization', 'clubs', 'catalog'] },
  { label: 'Account', to: '/account', keywords: ['settings', 'profile', 'security'] },
]

export function buildCommands(ctx: CommandContext): Command[] {
  const commands: Command[] = DESTINATIONS.map((destination) => ({
    id: `go:${destination.to}`,
    label: destination.label,
    group: 'Go to',
    keywords: destination.keywords,
    run: () => ctx.go?.(destination.to),
  }))

  if (ctx.role === 'admin') {
    commands.push({
      id: 'go:/admin/users',
      label: 'Admin',
      group: 'Go to',
      keywords: ['users', 'manage', 'panel'],
      run: () => ctx.go?.('/admin/users'),
    })
  }

  commands.push({
    id: 'create:link',
    label: 'Create a link',
    group: 'Create',
    keywords: ['new', 'shorten', 'add', 'url'],
    run: () => ctx.go?.('/links'),
  })

  for (const org of ctx.orgs) {
    commands.push({
      id: `org:${org.id}`,
      label: org.name,
      group: 'Switch org',
      keywords: ['organization', 'club', 'switch'],
      run: () => ctx.switchOrg?.(org.id),
    })
  }

  return commands
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** Lower is better. 0 starts the label, 1 starts a label word, 2 starts a keyword, 3 is a substring, -1 is no match. */
function rank(command: Command, query: string): number {
  const label = command.label.toLowerCase()
  if (label.startsWith(query)) return 0
  if (words(label).some((word) => word.startsWith(query))) return 1
  if (command.keywords.some((keyword) => words(keyword).some((word) => word.startsWith(query)))) return 2
  if (label.includes(query) || command.keywords.some((keyword) => keyword.toLowerCase().includes(query))) return 3
  return -1
}

export function filterCommands(list: Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return list
  return list
    .map((command, index) => ({ command, index, rank: rank(command, needle) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.command)
}

import { cn } from '@/lib/cn'

export function switchClasses(opts: {
  checked?: boolean
  className?: string
} = {}): string {
  const checked = opts.checked ?? false
  return cn(
    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-55',
    checked ? 'bg-g-primary' : 'bg-g-border',
    opts.className,
  )
}

export function switchThumbClasses(opts: { checked?: boolean } = {}): string {
  const checked = opts.checked ?? false
  return cn(
    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
    checked ? 'translate-x-5' : 'translate-x-0',
  )
}

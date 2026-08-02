import { cn } from '@/lib/cn'

export function fieldClasses(className?: string): string {
  return cn(
    'h-11 w-full rounded-xl border border-g-border bg-g-surface px-4 text-base text-g-text placeholder:text-g-muted outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
    className,
  )
}

export function textareaClasses(className?: string): string {
  return cn(
    'min-h-[6rem] w-full rounded-xl border border-g-border bg-g-surface px-4 py-3 text-base text-g-text placeholder:text-g-muted outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
    className,
  )
}

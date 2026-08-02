import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'default' | 'lg' | 'sm'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-g-primary text-g-primary-fg hover:brightness-110 border border-transparent',
  secondary:
    'border border-g-border bg-transparent text-g-text hover:bg-g-bg',
  ghost: 'bg-transparent text-g-muted hover:text-g-text hover:bg-g-bg',
  destructive: 'bg-g-destructive text-white hover:brightness-110 border border-transparent',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-full',
  default: 'h-11 px-5 text-base rounded-full',
  lg: 'h-12 px-6 text-base rounded-full',
}

export function buttonVariants(opts: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}): string {
  const variant = opts.variant ?? 'primary'
  const size = opts.size ?? 'default'
  return cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-55 disabled:pointer-events-none',
    variantClass[variant],
    sizeClass[size],
    opts.className,
  )
}

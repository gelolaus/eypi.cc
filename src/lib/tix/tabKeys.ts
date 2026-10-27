/** Arrow/Home/End keyboard support for a `role="tablist"` of buttons with roving tabindex. */
export function onTabKeydown(event: KeyboardEvent, count: number, current: number, select: (index: number) => void): void {
  let next = current
  if (event.key === 'ArrowRight') next = (current + 1) % count
  else if (event.key === 'ArrowLeft') next = (current - 1 + count) % count
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = count - 1
  else return
  event.preventDefault()
  select(next)
  const list = (event.currentTarget as HTMLElement | null)?.closest('[role="tablist"]')
  const tabs = list?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[next]?.focus()
}

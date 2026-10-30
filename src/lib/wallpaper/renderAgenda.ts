import { findConflicts, groupDays } from '@shared/schedule/layout'
import type { Entry } from '@shared/schedule/layout'
import { drawBackground } from './background'
import { formatClock } from './format'
import { contentBottom, contentTop } from './safeZone'
import { FONT_FAMILY as FAMILY, fitText, fontString } from './text'
import { THEMES } from './themes'
import type { RenderInput } from './types'

type Line =
  | { kind: 'day'; text: string }
  | { kind: 'row'; entry: Entry; conflict: boolean }

/** Layout B: classes listed by day, with days that share the same classes merged into one heading. */
export function renderAgenda(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { schedule, width, height } = input
  const theme = THEMES[input.theme]
  drawBackground(ctx, width, height, theme, input.photo, input.dim)

  const marginX = width * 0.09
  const titleSize = width * 0.052
  const dayRowSize = width * 0.034
  const rowSize = width * 0.044
  const limit = contentBottom(height)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  let y = contentTop(height)
  ctx.font = fontString(700, titleSize, FAMILY)
  ctx.fillStyle = theme.text
  ctx.fillText(schedule.term ?? 'Class schedule', marginX, y)
  y += titleSize * 1.9

  const groups = groupDays(schedule)
  if (groups.length === 0) {
    ctx.font = fontString(500, rowSize, FAMILY)
    ctx.fillStyle = theme.muted
    ctx.fillText('No classes to show.', marginX, y)
    return
  }

  const conflicts = findConflicts(schedule)
  const inConflict = (entry: Entry) =>
    conflicts.some((c) => [c.a, c.b].some((e) => e.code === entry.code && e.day === entry.day && e.start === entry.start))

  const lines: Line[] = groups.flatMap((group): Line[] => [
    { kind: 'day', text: group.days.join(' · ').toUpperCase() },
    ...group.entries.map((entry): Line => ({ kind: 'row', entry, conflict: inConflict(entry) })),
  ])
  const heightOf = (line: Line) => (line.kind === 'day' ? dayRowSize * 2.1 : rowSize * 1.85)
  const moreHeight = rowSize * 1.85

  let shown = lines.length
  const fits = (count: number, reserveMore: boolean) =>
    y + lines.slice(0, count).reduce((sum, line) => sum + heightOf(line), 0) + (reserveMore ? moreHeight : 0) <= limit
  if (!fits(lines.length, false)) {
    shown = lines.length
    while (shown > 0 && !fits(shown, true)) shown--
    while (shown > 0 && lines[shown - 1].kind === 'day') shown--
  }

  const timeColumn = marginX + width * 0.3
  for (const line of lines.slice(0, shown)) {
    if (line.kind === 'day') {
      ctx.font = fontString(700, dayRowSize, FAMILY)
      ctx.fillStyle = theme.accent
      ctx.fillText(line.text, marginX, y)
    } else {
      const { entry } = line
      ctx.font = fontString(500, rowSize, FAMILY)
      ctx.fillStyle = theme.muted
      ctx.fillText(entry.async ? '' : formatClock(entry.start), marginX, y)
      let x = timeColumn
      if (line.conflict) {
        ctx.font = fontString(800, rowSize, FAMILY)
        ctx.fillStyle = theme.accent
        ctx.fillText('!', x, y)
        x += rowSize * 0.8
      }
      const label = entry.async ? `${entry.code} · Async` : entry.room ? `${entry.code} · ${entry.room}` : entry.code
      const fitted = fitText(ctx, label, width - marginX - x, { size: rowSize, min: rowSize * 0.6, weight: 700, family: FAMILY })
      ctx.font = fontString(700, fitted.size, FAMILY)
      ctx.fillStyle = theme.text
      ctx.fillText(fitted.text, x, y)
    }
    y += heightOf(line)
  }

  if (shown < lines.length) {
    const hidden = lines.slice(shown).filter((line) => line.kind === 'row').length
    ctx.font = fontString(500, rowSize, FAMILY)
    ctx.fillStyle = theme.muted
    ctx.fillText(`+${hidden} more`, marginX, y)
  }
}

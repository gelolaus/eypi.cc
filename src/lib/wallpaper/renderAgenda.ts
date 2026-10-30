import { findConflicts, groupDays } from '@shared/schedule/layout'
import type { Entry } from '@shared/schedule/layout'
import { drawBackground } from './background'
import { formatClock, instructorsByCode } from './format'
import { contentBottom, contentTop, isLandscape, sizingUnit } from './safeZone'
import { FONT_FAMILY as FAMILY, fitText, fontString } from './text'
import { THEMES } from './themes'
import type { RenderInput } from './types'

type Line =
  | { kind: 'day'; text: string }
  | { kind: 'row'; entry: Entry; conflict: boolean }

const MAX_COLUMNS = 4

/** Layout B: classes listed by day, with days that share the same classes merged into one heading. */
export function renderAgenda(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { schedule, width, height } = input
  const unit = sizingUnit(width, height)
  const theme = THEMES[input.theme]
  drawBackground(ctx, width, height, theme, input.photo, input.dim)

  const marginX = width * (isLandscape(width, height) ? 0.07 : 0.09)
  const titleSize = unit * 0.052
  const dayRowSize = unit * 0.034
  const rowSize = unit * 0.044
  const limit = contentBottom(height)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  let y = contentTop(height, width)
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

  const instructors = instructorsByCode(schedule.subjects)
  const instructorSize = rowSize * 0.62
  const heightOf = (line: Line) => {
    if (line.kind === 'day') return dayRowSize * 2.1
    return instructors.get(line.entry.code) ? rowSize * 1.15 + instructorSize * 1.9 : rowSize * 1.85
  }
  const moreHeight = rowSize * 1.85

  // Portrait stacks every day group in one column; landscape sets the groups side by side.
  const columnCount = isLandscape(width, height) ? Math.min(groups.length, MAX_COLUMNS) : 1
  const gutter = unit * 0.08
  const columnW = (width - marginX * 2 - gutter * (columnCount - 1)) / columnCount
  const toLines = (group: (typeof groups)[number]): Line[] => [
    { kind: 'day', text: group.days.join(' · ').toUpperCase() },
    ...group.entries.map((entry): Line => ({ kind: 'row', entry, conflict: inConflict(entry) })),
  ]

  for (let column = 0; column < columnCount; column++) {
    const lines = groups.filter((_, i) => i % columnCount === column).flatMap(toLines)
    drawColumn(lines, marginX + column * (columnW + gutter), columnW)
  }

  function drawColumn(lines: Line[], left: number, columnWidth: number): void {
    let top = y
    let shown = lines.length
    const fits = (count: number, reserveMore: boolean) =>
      top + lines.slice(0, count).reduce((sum, line) => sum + heightOf(line), 0) + (reserveMore ? moreHeight : 0) <= limit
    if (!fits(lines.length, false)) {
      while (shown > 0 && !fits(shown, true)) shown--
      while (shown > 0 && lines[shown - 1].kind === 'day') shown--
    }

    const right = left + columnWidth
    const timeColumn = left + unit * 0.3
    for (const line of lines.slice(0, shown)) {
      if (line.kind === 'day') {
        ctx.font = fontString(700, dayRowSize, FAMILY)
        ctx.fillStyle = theme.accent
        ctx.fillText(line.text, left, top)
      } else {
        const { entry } = line
        ctx.font = fontString(500, rowSize, FAMILY)
        ctx.fillStyle = theme.muted
        ctx.fillText(entry.async ? '' : formatClock(entry.start), left, top)
        let x = timeColumn
        if (line.conflict) {
          ctx.font = fontString(800, rowSize, FAMILY)
          ctx.fillStyle = theme.accent
          ctx.fillText('!', x, top)
          x += rowSize * 0.8
        }
        const label = entry.async ? `${entry.code} · Async` : entry.room ? `${entry.code} · ${entry.room}` : entry.code
        const fitted = fitText(ctx, label, right - x, { size: rowSize, min: rowSize * 0.6, weight: 700, family: FAMILY })
        ctx.font = fontString(700, fitted.size, FAMILY)
        ctx.fillStyle = theme.text
        ctx.fillText(fitted.text, x, top)
        const instructor = instructors.get(entry.code)
        if (instructor) {
          const small = fitText(ctx, instructor, right - x, { size: instructorSize, min: instructorSize * 0.7, weight: 500, family: FAMILY })
          ctx.font = fontString(500, small.size, FAMILY)
          ctx.fillStyle = theme.muted
          ctx.fillText(small.text, x, top + rowSize * 1.15)
        }
      }
      top += heightOf(line)
    }

    if (shown < lines.length) {
      const hidden = lines.slice(shown).filter((line) => line.kind === 'row').length
      ctx.font = fontString(500, rowSize, FAMILY)
      ctx.fillStyle = theme.muted
      ctx.fillText(`+${hidden} more`, left, top)
    }
  }
}

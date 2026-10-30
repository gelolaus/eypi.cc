import { entriesByDay, timelineRange } from '@shared/schedule/layout'
import type { Entry } from '@shared/schedule/layout'
import type { Day } from '@shared/schedule/types'
import { drawBackground } from './background'
import { formatClockShort, instructorsByCode } from './format'
import { contentBottom, contentTop } from './safeZone'
import { FONT_FAMILY as FAMILY, fitText, fontString } from './text'
import { THEMES, readableOn } from './themes'
import type { RenderInput } from './types'


/** Classes start at 7:30 and run in two-hour slots, so the grid is labelled every two hours from 7:30. */
const LABEL_ANCHOR = 7 * 60 + 30
const LABEL_STEP = 120

/** Gives each entry a lane so overlapping classes sit side by side. */
function assignLanes(entries: Entry[]): { entry: Entry; lane: number; lanes: number }[] {
  const sorted = [...entries].sort((a, b) => a.start - b.start || a.end - b.end)
  const placed: { entry: Entry; lane: number; lanes: number }[] = []
  let cluster: typeof placed = []
  let clusterEnd = -1
  const close = () => {
    const lanes = cluster.reduce((max, item) => Math.max(max, item.lane + 1), 1)
    for (const item of cluster) item.lanes = lanes
    placed.push(...cluster)
    cluster = []
  }
  for (const entry of sorted) {
    if (cluster.length > 0 && entry.start >= clusterEnd) close()
    const taken = new Set(cluster.filter((item) => item.entry.end > entry.start).map((item) => item.lane))
    let lane = 0
    while (taken.has(lane)) lane++
    cluster.push({ entry, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, entry.end)
  }
  close()
  return placed
}

/** Layout A: a weekly grid with one column per day that has classes and blocks placed by time. */
export function renderGrid(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { schedule, width, height } = input
  const theme = THEMES[input.theme]
  drawBackground(ctx, width, height, theme, input.photo, input.dim)

  const marginX = width * 0.06
  const titleSize = width * 0.052
  const smallSize = width * 0.026
  const limit = contentBottom(height)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  let y = contentTop(height)
  ctx.font = fontString(700, titleSize, FAMILY)
  ctx.fillStyle = theme.text
  ctx.fillText(schedule.term ?? 'Class schedule', marginX, y)
  y += titleSize * 1.9

  const byDay = entriesByDay(schedule)
  const days = (Object.keys(byDay) as Day[]).filter((day) => byDay[day]!.some((entry) => !entry.async))
  const asyncEntries = Object.values(byDay).flat().filter((entry) => entry.async)

  const drawAsync = (top: number) => {
    if (asyncEntries.length === 0) return
    const codes = [...new Set(asyncEntries.map((entry) => entry.code))].join(', ')
    const fitted = fitText(ctx, `Async · ${codes}`, width - marginX * 2, { size: smallSize * 1.2, min: smallSize * 0.7, weight: 600, family: FAMILY })
    ctx.textAlign = 'left'
    ctx.font = fontString(600, fitted.size, FAMILY)
    ctx.fillStyle = theme.muted
    ctx.fillText(fitted.text, marginX, top)
  }

  if (days.length === 0) {
    if (asyncEntries.length > 0) {
      drawAsync(y)
    } else {
      ctx.font = fontString(500, width * 0.044, FAMILY)
      ctx.fillStyle = theme.muted
      ctx.fillText('No classes to show.', marginX, y)
    }
    return
  }

  const { startHour, endHour } = timelineRange(schedule)
  const hours = endHour - startHour
  const gridLeft = marginX + width * 0.11
  const gridRight = width - marginX
  const colW = (gridRight - gridLeft) / days.length
  const headerH = width * 0.06
  const hoursTop = y + headerH
  const asyncH = asyncEntries.length > 0 ? smallSize * 3 : 0
  const hourH = Math.min((limit - asyncH - hoursTop) / hours, width * 0.2)
  const gridBottom = hoursTop + hours * hourH

  ctx.font = fontString(700, smallSize, FAMILY)
  ctx.fillStyle = theme.accent
  ctx.textAlign = 'center'
  days.forEach((day, i) => ctx.fillText(day.toUpperCase(), gridLeft + colW * (i + 0.5), y))

  ctx.font = fontString(500, smallSize * 0.9, FAMILY)
  const drawLine = (lineY: number) => {
    ctx.fillStyle = theme.muted
    ctx.globalAlpha = 0.35
    ctx.fillRect(gridLeft, lineY, gridRight - gridLeft, Math.max(1, width * 0.0012))
    ctx.globalAlpha = 1
  }
  // The borders sit on the whole hours; the lines and labels sit on the class times.
  drawLine(hoursTop)
  drawLine(gridBottom)
  const firstLabel = LABEL_ANCHOR + Math.ceil((startHour * 60 - LABEL_ANCHOR) / LABEL_STEP) * LABEL_STEP
  for (let minute = firstLabel; minute <= endHour * 60; minute += LABEL_STEP) {
    const lineY = hoursTop + (minute / 60 - startHour) * hourH
    drawLine(lineY)
    ctx.textAlign = 'left'
    ctx.fillStyle = theme.muted
    ctx.fillText(formatClockShort(minute), marginX, lineY + smallSize * 0.3)
  }

  const codes = [...new Set(schedule.subjects.map((subject) => subject.code))]
  const instructors = instructorsByCode(schedule.subjects)
  const gap = width * 0.004
  const radius = width * 0.014
  days.forEach((day, i) => {
    const timed = byDay[day]!.filter((entry) => !entry.async)
    for (const { entry, lane, lanes } of assignLanes(timed)) {
      const laneW = colW / lanes
      const x = gridLeft + colW * i + laneW * lane + gap
      const top = hoursTop + (entry.start / 60 - startHour) * hourH + gap
      const w = laneW - gap * 2
      const h = ((entry.end - entry.start) / 60) * hourH - gap * 2
      const color = theme.blocks[codes.indexOf(entry.code) % theme.blocks.length]
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(x, top, w, h, radius)
      ctx.fill()

      const padding = w * 0.08
      const textColor = readableOn(color)
      const codeSize = Math.min(width * 0.03, h * 0.4)
      const label = fitText(ctx, entry.code, w - padding * 2, { size: codeSize, min: codeSize * 0.6, weight: 700, family: FAMILY })
      ctx.textAlign = 'left'
      ctx.font = fontString(700, label.size, FAMILY)
      ctx.fillStyle = textColor
      ctx.fillText(label.text, x + padding, top + padding)
      if (entry.room && h > label.size * 3) {
        const roomSize = label.size * 0.85
        const room = fitText(ctx, entry.room, w - padding * 2, { size: roomSize, min: roomSize * 0.6, weight: 500, family: FAMILY })
        ctx.font = fontString(500, room.size, FAMILY)
        ctx.fillText(room.text, x + padding, top + padding + label.size * 1.3)
      }
      const instructor = instructors.get(entry.code)
      if (instructor && h > label.size * 4.6) {
        const nameSize = label.size * 0.75
        const name = fitText(ctx, instructor, w - padding * 2, { size: nameSize, min: nameSize * 0.6, weight: 500, family: FAMILY })
        ctx.font = fontString(500, name.size, FAMILY)
        ctx.fillText(name.text, x + padding, top + padding + label.size * 2.3)
      }
    }
  })

  drawAsync(gridBottom + smallSize)
}

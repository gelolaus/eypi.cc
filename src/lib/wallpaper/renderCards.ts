import type { Subject } from '@shared/schedule/types'
import { drawBackground } from './background'
import { formatRange } from './format'
import { contentBottom, contentTop } from './safeZone'
import { FONT_FAMILY as FAMILY, fitText, fontString } from './text'
import { THEMES, readableOn } from './themes'
import type { RenderInput } from './types'

const MAX_CARDS = 7
const MAX_LINES = 4

/** One line per distinct time and room, with the days that share it joined: `Tue Fri · 7:30 to 9:30 AM · 208`. */
function meetingLines(subject: Subject): string[] {
  const groups = new Map<string, { days: string[]; text: string }>()
  for (const meeting of subject.meetings) {
    const key = [meeting.start, meeting.end, meeting.room, meeting.async ?? false].join('|')
    const place = meeting.async ? 'Async' : meeting.room
    const group = groups.get(key) ?? { days: [], text: [formatRange(meeting.start, meeting.end), place].filter(Boolean).join(' · ') }
    if (!group.days.includes(meeting.day)) group.days.push(meeting.day)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) => `${group.days.join(' ')} · ${group.text}`).slice(0, MAX_LINES)
}

/** Layout C: one rounded card per subject, in the order pasted. */
export function renderCards(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { schedule, width, height } = input
  const theme = THEMES[input.theme]
  drawBackground(ctx, width, height, theme, input.photo, input.dim)

  const marginX = width * 0.07
  const titleSize = width * 0.052
  const padding = width * 0.024
  const codeSize = width * 0.038
  const lineSize = width * 0.028
  const gap = width * 0.018
  const limit = contentBottom(height)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  let y = contentTop(height)
  ctx.font = fontString(700, titleSize, FAMILY)
  ctx.fillStyle = theme.text
  ctx.fillText(schedule.term ?? 'Class schedule', marginX, y)
  y += titleSize * 1.9

  const subjects = schedule.subjects
  if (subjects.length === 0) {
    ctx.font = fontString(500, width * 0.044, FAMILY)
    ctx.fillStyle = theme.muted
    ctx.fillText('No classes to show.', marginX, y)
    return
  }

  const lines = subjects.map(meetingLines)
  const rows = Math.max(1, ...lines.slice(0, MAX_CARDS).map((l) => l.length))
  const cardH = padding * 2 + codeSize * 1.35 + rows * lineSize * 1.45
  const moreH = lineSize * 2
  const capacity = (reserve: number) => Math.floor((limit - y - reserve + gap) / (cardH + gap))
  let shown = Math.min(subjects.length, MAX_CARDS, capacity(0))
  if (shown < subjects.length) shown = Math.min(MAX_CARDS, capacity(moreH))
  shown = Math.max(shown, 0)

  const cardW = width - marginX * 2
  for (let i = 0; i < shown; i++) {
    const color = theme.blocks[i % theme.blocks.length]
    const textColor = readableOn(color)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(marginX, y, cardW, cardH, width * 0.026)
    ctx.fill()

    const textW = cardW - padding * 2
    ctx.font = fontString(700, codeSize, FAMILY)
    ctx.fillStyle = textColor
    ctx.fillText(subjects[i].code, marginX + padding, y + padding)
    let lineY = y + padding + codeSize * 1.35
    for (const line of lines[i]) {
      const fitted = fitText(ctx, line, textW, { size: lineSize, min: lineSize * 0.7, weight: 500, family: FAMILY })
      ctx.font = fontString(500, fitted.size, FAMILY)
      ctx.fillText(fitted.text, marginX + padding, lineY)
      lineY += lineSize * 1.45
    }
    y += cardH + gap
  }

  if (shown < subjects.length) {
    ctx.font = fontString(500, lineSize * 1.2, FAMILY)
    ctx.fillStyle = theme.muted
    ctx.fillText(`+${subjects.length - shown} more`, marginX, y)
  }
}

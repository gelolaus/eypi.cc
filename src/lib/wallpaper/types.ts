import type { ParsedSchedule } from '@shared/schedule/types'

export type LayoutId = 'grid' | 'agenda' | 'cards'
export type ThemeName = 'light' | 'dark' | 'black' | 'apc'

export type RenderInput = {
  schedule: ParsedSchedule
  width: number
  height: number
  theme: ThemeName
  layout: LayoutId
  photo: ImageBitmap | null
  dim: number
}

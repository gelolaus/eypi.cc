// Hardware seams for the photo booth, so tests can fake the camera without a device.
import type { InjectionKey } from 'vue'
import { openCamera } from '@/lib/booth/camera'
import { captureVideoFrame, decodePhoto } from '@/lib/booth/capture'

export type Facing = 'user' | 'environment'

export interface BoothDeps {
  openCamera: (facing: Facing) => Promise<MediaStream>
  userAgent: () => string
  isSecureContext: () => boolean
  capture: (video: HTMLVideoElement) => HTMLCanvasElement | null
  decodePhoto: (file: File) => Promise<ImageBitmap>
}

export const defaultBoothDeps: BoothDeps = {
  openCamera: (facing) => openCamera(facing),
  userAgent: () => (typeof navigator === 'undefined' ? '' : navigator.userAgent),
  isSecureContext: () => typeof window === 'undefined' || window.isSecureContext !== false,
  capture: captureVideoFrame,
  decodePhoto,
}

/** Provide a partial set to replace any seam (tests, previews). */
export const boothDepsKey: InjectionKey<Partial<BoothDeps>> = Symbol('boothDeps')

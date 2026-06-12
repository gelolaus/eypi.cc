import { ref, type Ref } from 'vue'

// Unified Pointer-Events pan/zoom engine for the DP Blast public editor.
//
// State model (canvas-pixel space, so it works identically for the responsive
// on-screen display and the native-resolution PNG export):
//   • scale   — multiplier applied on top of the view's cover-fit base scale.
//   • offsetX / offsetY — translation of the headshot's CENTRE away from the
//     canvas centre. (0, 0) means perfectly centred.
//
// The owning view reads these reactive values and redraws via requestAnimationFrame.
export interface DpCanvasOptions {
  minScale?: number
  maxScale?: number
}

export function useDpCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  options: DpCanvasOptions = {},
) {
  const minScale = options.minScale ?? 0.2
  const maxScale = options.maxScale ?? 8

  const scale = ref(1)
  const offsetX = ref(0)
  const offsetY = ref(0)

  // Active pointers keyed by pointerId (client coordinates).
  const pointers = new Map<number, { x: number; y: number }>()
  let lastDist = 0
  let lastMidX = 0
  let lastMidY = 0

  // Conversion ratio between displayed CSS pixels and the canvas backing store.
  function getRatio() {
    const canvas = canvasRef.value
    if (!canvas) return { x: 1, y: 1 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: rect.width ? canvas.width / rect.width : 1,
      y: rect.height ? canvas.height / rect.height : 1,
    }
  }

  // Client coordinates → canvas-pixel coordinates.
  function clientToCanvas(clientX: number, clientY: number) {
    const canvas = canvasRef.value
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const ratio = getRatio()
    return {
      x: (clientX - rect.left) * ratio.x,
      y: (clientY - rect.top) * ratio.y,
    }
  }

  function panBy(dxClient: number, dyClient: number) {
    const ratio = getRatio()
    offsetX.value += dxClient * ratio.x
    offsetY.value += dyClient * ratio.y
  }

  // Zoom by `factor`, keeping the focal client point visually fixed.
  function applyZoom(factor: number, focalClientX: number, focalClientY: number) {
    const canvas = canvasRef.value
    if (!canvas) return
    const next = Math.min(maxScale, Math.max(minScale, scale.value * factor))
    const k = next / scale.value
    if (k === 1) return

    const f = clientToCanvas(focalClientX, focalClientY)
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const cOldX = centerX + offsetX.value
    const cOldY = centerY + offsetY.value
    // Keep focal fixed: F - cNew = k * (F - cOld)
    offsetX.value = f.x - k * (f.x - cOldX) - centerX
    offsetY.value = f.y - k * (f.y - cOldY) - centerY
    scale.value = next
  }

  function onPointerDown(e: PointerEvent) {
    const canvas = canvasRef.value
    if (!canvas) return
    canvas.setPointerCapture?.(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const pts = [...pointers.values()]
      lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      lastMidX = (pts[0].x + pts[1].x) / 2
      lastMidY = (pts[0].y + pts[1].y) / 2
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev) return

    if (pointers.size === 1) {
      // Drag to pan.
      panBy(e.clientX - prev.x, e.clientY - prev.y)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      return
    }

    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = [...pointers.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      // Two-finger drag pans; the spread/pinch zooms toward the midpoint.
      panBy(midX - lastMidX, midY - lastMidY)
      if (lastDist > 0) applyZoom(dist / lastDist, midX, midY)
      lastDist = dist
      lastMidX = midX
      lastMidY = midY
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId)
    canvasRef.value?.releasePointerCapture?.(e.pointerId)
    if (pointers.size < 2) lastDist = 0
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    applyZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY)
  }

  function reset() {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
    pointers.clear()
    lastDist = 0
  }

  return {
    scale,
    offsetX,
    offsetY,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    reset,
  }
}

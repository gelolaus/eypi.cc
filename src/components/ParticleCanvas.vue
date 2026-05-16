<template>
  <canvas ref="canvas" class="particle-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  rotation: number
  rotationSpeed: number
  color: string
}

const MAX_PARTICLES = 100
const SPAWN_PER_FRAME = 3

const PALETTE = [
  '#FF3B30', '#FF9500', '#FFCC00', '#30D158',
  '#007AFF', '#BF5AF2', '#FF375F', '#00C7BE',
]

function createParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 1.5 + Math.random() * 2
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: [4, 6, 8, 10][Math.floor(Math.random() * 4)],
    alpha: 1,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.18,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  }
}

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let isDown = false
let mouseX = 0
let mouseY = 0
let rafId = 0

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

function tick() {
  if (!ctx || !canvas.value) { rafId = requestAnimationFrame(tick); return }
  const c = ctx
  const cv = canvas.value

  c.clearRect(0, 0, cv.width, cv.height)

  if (isDown) {
    for (let i = 0; i < SPAWN_PER_FRAME; i++) {
      particles.push(createParticle(mouseX, mouseY))
      if (particles.length > MAX_PARTICLES) particles.shift()
    }
  }

  particles = particles.filter((p) => {
    p.x += p.vx
    p.y += p.vy
    p.alpha -= 0.016
    p.rotation += p.rotationSpeed

    if (p.alpha <= 0) return false

    c.save()
    c.globalAlpha = p.alpha
    c.fillStyle = p.color
    c.translate(p.x, p.y)
    c.rotate(p.rotation)
    c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    c.restore()
    return true
  })

  rafId = requestAnimationFrame(tick)
}

function onMouseDown(e: MouseEvent) {
  isDown = true
  mouseX = e.clientX
  mouseY = e.clientY
}

function onMouseMove(e: MouseEvent) {
  // Auto-correct isDown if mouseup was missed (e.g. during native drag-and-drop)
  if (e.buttons === 0) isDown = false
  mouseX = e.clientX
  mouseY = e.clientY
}

function onMouseUp() {
  isDown = false
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  const isTouch = window.matchMedia('(pointer: coarse)').matches

  resize()
  window.addEventListener('resize', resize)
  rafId = requestAnimationFrame(tick)

  // Confetti is a mouse-only feature — skip event listeners on touch devices
  if (isTouch) return

  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<style scoped>
.particle-canvas {
  position: fixed;
  inset: 0;
  z-index: 9997;
  pointer-events: none;
}
</style>

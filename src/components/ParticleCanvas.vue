<template>
  <canvas ref="canvas" class="particle-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  rotation: number
  rotationSpeed: number
}

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let rafId = 0
let isDown = false

const COLORS = [
  '#DEAC4B', // APC Gold
  '#FF9500', // orange
  '#FFCC00', // yellow
  '#34C759', // green
  '#007AFF', // blue
  '#34418F', // APC Blue
  '#FF2D55', // pink
  '#5AC8FA', // teal
]
const SIZES = [4, 6, 8, 10]

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function spawnParticles(x: number, y: number, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2)
    const speed = rand(1.5, 5)
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(1, 3),
      size: SIZES[Math.floor(Math.random() * SIZES.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-0.09, 0.09),
    })
  }
  if (particles.length > 120) {
    particles.splice(0, particles.length - 120)
  }
}

function draw() {
  if (!ctx || !canvas.value) { rafId = requestAnimationFrame(draw); return }
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  particles = particles.filter(p => p.alpha > 0.01)

  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.22
    p.alpha -= 0.016
    p.rotation += p.rotationSpeed

    ctx.save()
    ctx.globalAlpha = Math.max(0, p.alpha)
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    ctx.restore()
  }

  rafId = requestAnimationFrame(draw)
}

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

function onMouseDown(e: MouseEvent) {
  isDown = true
  spawnParticles(e.clientX, e.clientY, 8)
}

function onMouseMove(e: MouseEvent) {
  if (isDown) spawnParticles(e.clientX, e.clientY, 4)
}

function onMouseUp() {
  isDown = false
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  resize()
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('mousedown', onMouseDown, { passive: true })
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseup', onMouseUp, { passive: true })
  rafId = requestAnimationFrame(draw)
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
  pointer-events: none;
  z-index: 9997;
}
</style>

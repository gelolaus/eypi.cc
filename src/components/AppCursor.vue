<template>
  <div
    v-if="!isTouch"
    ref="cursorEl"
    class="app-cursor app-cursor--visible"
    :class="`cursor--${state}`"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type CursorState = 'default' | 'nav' | 'cta' | 'card' | 'text'

const cursorEl = ref<HTMLElement | null>(null)
const state = ref<CursorState>('default')
const isTouch = ref(false)

let mouseX = 0
let mouseY = 0
let curX = 0
let curY = 0
let rafId = 0

const SPRING = 0.38

function animate() {
  curX += (mouseX - curX) * SPRING
  curY += (mouseY - curY) * SPRING

  if (cursorEl.value) {
    cursorEl.value.style.transform = `translate(${curX}px, ${curY}px) translate(-50%, -50%)`
  }

  rafId = requestAnimationFrame(animate)
}

function onMouseMove(e: MouseEvent) {
  mouseX = e.clientX
  mouseY = e.clientY
}

const TEXT_FIELD_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="range"]):not([type="hidden"]), textarea, [contenteditable="true"]'

function resolveState(el: Element | null): CursorState {
  if (!el) return 'default'

  // I-beam only on real text fields — never on headings or labels
  if (el.closest(TEXT_FIELD_SELECTOR)) return 'text'

  const explicit = el.closest('[data-cursor]') as HTMLElement | null
  if (explicit?.dataset.cursor) {
    const type = explicit.dataset.cursor
    if (type === 'nav' || type === 'cta' || type === 'card') return type
  }

  const target = (explicit ?? el.closest(
    'a, button, input, textarea, select, label[for], summary, [role="button"], [role="link"], [role="tab"]',
  )) as HTMLElement | null
  if (!target) return 'default'

  if (
    target.matches('[type="submit"], .btn-primary, .pill-nav__cta')
    || target.closest('[data-cursor="cta"]')
  ) {
    return 'cta'
  }

  if (
    target.matches('a[data-cursor="card"], .mica-card > a, a.mica-card')
    || (target.matches('a') && target.classList.contains('mica-card'))
  ) {
    return 'card'
  }

  if (target.matches('a, button, [role="button"], [role="link"], [role="tab"], select, summary, label[for]')) {
    return 'nav'
  }

  return 'default'
}

function onMouseOver(e: MouseEvent) {
  state.value = resolveState(e.target as Element)
}

function setCustomCursor(enabled: boolean) {
  document.documentElement.classList.toggle('has-custom-cursor', enabled)
}

onMounted(() => {
  isTouch.value = window.matchMedia('(pointer: coarse)').matches
  if (isTouch.value) return

  setCustomCursor(true)
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseover', onMouseOver, { passive: true })
  rafId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseover', onMouseOver)
  cancelAnimationFrame(rafId)
  setCustomCursor(false)
})
</script>

<style scoped>
.app-cursor {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 99999;
  will-change: transform, width, height, background-color;
  border-radius: 9999px;
  transition:
    width 0.15s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.15s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.12s ease,
    mix-blend-mode 0s;
}

.cursor--default {
  width: 24px;
  height: 24px;
  background-color: #ffffff;
  mix-blend-mode: difference;
}

.cursor--nav {
  width: 34px;
  height: 34px;
  background-color: #DEAC4B;
  mix-blend-mode: normal;
}

.cursor--cta {
  width: 48px;
  height: 48px;
  background-color: #DEAC4B;
  mix-blend-mode: normal;
}

.cursor--card {
  width: 80px;
  height: 80px;
  background-color: #34418F;
  mix-blend-mode: normal;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cursor--card::after {
  content: 'VIEW →';
  color: #ffffff;
  font-family: 'Geist Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  pointer-events: none;
  position: absolute;
}

.cursor--text {
  width: 2px;
  height: 22px;
  background-color: #DEAC4B;
  mix-blend-mode: normal;
  border-radius: 1px;
}
</style>

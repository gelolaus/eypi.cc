<template>
  <section
    id="features"
    class="relative w-full px-6 py-16 md:py-24"
    aria-labelledby="features-heading"
  >
    <div class="mx-auto w-full max-w-5xl">
      <div class="reveal mb-10 text-center md:mb-14">
        <h2 id="features-heading" class="features-heading">
          One login. Five tools your org already needs.
        </h2>
      </div>

      <div
        ref="carouselRegionRef"
        class="features-carousel reveal delay-1"
        role="region"
        aria-roledescription="carousel"
        aria-label="Eypi.cc features"
        tabindex="0"
        @keydown="onKeydown"
        @mouseenter="pauseAutoplay"
        @mouseleave="resumeAutoplay"
        @focusin="pauseAutoplay"
        @focusout="onFocusOut"
      >
        <div class="features-carousel__controls">
          <button
            type="button"
            class="features-carousel__nav tap-scale"
            aria-label="Previous feature"
            data-cursor="nav"
            @click="goPrev"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            class="features-carousel__nav tap-scale"
            aria-label="Next feature"
            data-cursor="nav"
            @click="goNext"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div
          ref="trackRef"
          class="features-carousel__track"
          :class="{ 'features-carousel__track--dragging': isDragging }"
          @scroll="onScroll"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @pointerleave="onPointerUp"
        >
          <article
            v-for="(slide, displayIndex) in displaySlides"
            :key="`${slide.feature.id}-${slide.isClone ? 'clone' : 'real'}-${displayIndex}`"
            :ref="(el) => setCardRef(el as HTMLElement | null, displayIndex)"
            class="features-carousel__card mica-card"
            :class="{ 'features-carousel__card--active': activeIndex === slide.realIndex }"
            :aria-hidden="activeIndex !== slide.realIndex"
            data-cursor="card"
            @click="onCardClick(displayIndex, $event)"
          >
            <div
              class="features-carousel__icon"
              :style="{ color: slide.feature.accent }"
              aria-hidden="true"
            >
              <component :is="slide.feature.icon" />
            </div>
            <h3 class="text-card-title mb-2">{{ slide.feature.name }}</h3>
            <p class="mb-4 text-sm leading-relaxed text-g-muted">
              {{ slide.feature.description }}
            </p>
            <ul class="mb-6 flex flex-1 flex-col gap-2 text-sm text-g-text">
              <li
                v-for="bullet in slide.feature.bullets"
                :key="bullet"
                class="flex items-start gap-2"
              >
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#DEAC4B]" aria-hidden="true" />
                <span>{{ bullet }}</span>
              </li>
            </ul>
            <router-link
              :to="slide.feature.ctaTo"
              class="features-carousel__cta tap-scale"
              data-cursor="nav"
              @click.stop
            >
              {{ slide.feature.ctaLabel }}
              <span aria-hidden="true">→</span>
            </router-link>
          </article>
        </div>

        <div class="features-carousel__indicator" aria-live="polite">
          <span class="features-carousel__index text-data">
            {{ String(activeIndex + 1).padStart(2, '0') }} / {{ String(features.length).padStart(2, '0') }}
          </span>
          <div class="features-carousel__segments" role="tablist" aria-label="Feature slides">
            <button
              v-for="(feature, index) in features"
              :key="feature.id"
              type="button"
              role="tab"
              class="features-carousel__segment tap-scale"
              :class="{
                'features-carousel__segment--active': activeIndex === index,
                'features-carousel__segment--paused': autoplayPaused || prefersReducedMotion,
              }"
              :aria-selected="activeIndex === index"
              :aria-label="`Go to ${feature.name}`"
              data-cursor="nav"
              @click="scrollToRealIndex(index)"
            >
              <span class="features-carousel__segment-fill" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type Component, h } from 'vue'
import { useReveal } from '@/composables/useReveal'

useReveal()

interface Feature {
  id: string
  name: string
  description: string
  bullets: string[]
  ctaTo: string
  ctaLabel: string
  accent: string
  icon: Component
}

interface DisplaySlide {
  feature: Feature
  realIndex: number
  isClone: boolean
}

const IconLinks = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' }),
    ]),
}

const IconForms = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }),
    ]),
}

const IconTix = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' }),
    ]),
}

const IconFrames = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' }),
    ]),
}

const IconOrgs = {
  render: () =>
    h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }),
    ]),
}

const features: Feature[] = [
  {
    id: 'links',
    name: 'Links',
    description: 'Turn long URLs into branded eypi.cc short links and see who is clicking them.',
    bullets: ['Custom slugs & QR codes', 'Click analytics by device & country', 'No ads, no paywalls'],
    ctaTo: '/login',
    ctaLabel: 'Shorten a link',
    accent: '#34418F',
    icon: IconLinks,
  },
  {
    id: 'forms',
    name: 'Forms',
    description: 'Fill in event and org details once, then auto-generate official APC paperwork.',
    bullets: ['Concessionaire contracts', 'Visitor passes from a CSV list', 'Letter of intent & waivers'],
    ctaTo: '/login',
    ctaLabel: 'Generate paperwork',
    accent: '#DEAC4B',
    icon: IconForms,
  },
  {
    id: 'tix',
    name: 'Tix',
    description: 'Run org events with QR tickets, guest lists, and camera-based check-in.',
    bullets: ['CSV or manual attendee lists', 'QR scanner check-in', 'Public ticket lookup + Wallet'],
    ctaTo: '/login',
    ctaLabel: 'Set up an event',
    accent: '#34418F',
    icon: IconTix,
  },
  {
    id: 'frames',
    name: 'Frames',
    description: 'Upload org frame overlays and let anyone create a matching profile picture.',
    bullets: ['Custom frame overlays', 'One shareable public link', 'No login needed to join'],
    ctaTo: '/login',
    ctaLabel: 'Launch a frame',
    accent: '#DEAC4B',
    icon: IconFrames,
  },
  {
    id: 'orgs',
    name: 'Orgs',
    description: 'A public directory of APC student organizations with rich profile pages.',
    bullets: ['Searchable public catalog', 'Full profile pages', 'Linked events & socials'],
    ctaTo: '/orgs',
    ctaLabel: 'Browse orgs',
    accent: '#34418F',
    icon: IconOrgs,
  },
]

const displaySlides = computed<DisplaySlide[]>(() => {
  const last = features[features.length - 1]
  const first = features[0]
  return [
    { feature: last, realIndex: features.length - 1, isClone: true },
    ...features.map((feature, index) => ({ feature, realIndex: index, isClone: false })),
    { feature: first, realIndex: 0, isClone: true },
  ]
})

const trackRef = ref<HTMLElement | null>(null)
const carouselRegionRef = ref<HTMLElement | null>(null)
const cardRefs = ref<(HTMLElement | null)[]>([])
const activeIndex = ref(0)
const isDragging = ref(false)
const prefersReducedMotion = ref(false)
const autoplayPaused = ref(false)

let dragStartX = 0
let dragStartScrollLeft = 0
let scrollRaf: number | null = null
let coverflowRaf: number | null = null
let settleTimer: ReturnType<typeof setTimeout> | null = null
let autoplayTimer: ReturnType<typeof setInterval> | null = null
let reducedMotionQuery: MediaQueryList | null = null
let isJumping = false
let dragMoved = false

function setCardRef(el: HTMLElement | null, index: number) {
  cardRefs.value[index] = el
}

function getDisplayIndexFromScroll(): number {
  const track = trackRef.value
  if (!track || cardRefs.value.length === 0) return 1

  const trackCenter = track.scrollLeft + track.clientWidth / 2
  let closestIndex = 1
  let closestDistance = Infinity

  cardRefs.value.forEach((card, index) => {
    if (!card) return
    const cardCenter = card.offsetLeft + card.offsetWidth / 2
    const distance = Math.abs(trackCenter - cardCenter)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })

  return closestIndex
}

function scrollToDisplayIndex(displayIndex: number, behavior: ScrollBehavior = 'smooth') {
  const track = trackRef.value
  const card = cardRefs.value[displayIndex]
  if (!track || !card) return

  track.scrollTo({
    left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
    behavior: prefersReducedMotion.value ? 'auto' : behavior,
  })
}

function scrollToRealIndex(realIndex: number, behavior: ScrollBehavior = 'smooth') {
  scrollToDisplayIndex(realIndex + 1, behavior)
  activeIndex.value = realIndex
  restartSegmentAnimation()
}

function correctClonePosition(displayIndex: number) {
  const track = trackRef.value
  if (!track) return

  if (displayIndex === 0) {
    isJumping = true
    scrollToDisplayIndex(features.length, 'auto')
    activeIndex.value = features.length - 1
    requestAnimationFrame(() => { isJumping = false })
    return
  }

  if (displayIndex === displaySlides.value.length - 1) {
    isJumping = true
    scrollToDisplayIndex(1, 'auto')
    activeIndex.value = 0
    requestAnimationFrame(() => { isJumping = false })
  }
}

function updateCoverflow() {
  const track = trackRef.value
  if (!track || prefersReducedMotion.value) {
    cardRefs.value.forEach((card) => {
      if (!card) return
      card.style.transform = ''
      card.style.opacity = ''
    })
    return
  }

  const trackCenter = track.scrollLeft + track.clientWidth / 2
  const maxDistance = track.clientWidth * 0.55

  cardRefs.value.forEach((card) => {
    if (!card) return
    const cardCenter = card.offsetLeft + card.offsetWidth / 2
    const distance = Math.abs(trackCenter - cardCenter)
    const t = Math.min(distance / maxDistance, 1)
    const scale = 1 - t * 0.12
    const opacity = 1 - t * 0.45
    card.style.transform = `scale(${scale})`
    card.style.opacity = String(opacity)
  })
}

function scheduleSettle() {
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    const displayIndex = getDisplayIndexFromScroll()
    const slide = displaySlides.value[displayIndex]
    if (slide) activeIndex.value = slide.realIndex
    correctClonePosition(displayIndex)
    restartSegmentAnimation()
  }, 150)
}

function onScroll() {
  if (scrollRaf !== null) return
  scrollRaf = requestAnimationFrame(() => {
    if (!isJumping) {
      const displayIndex = getDisplayIndexFromScroll()
      const slide = displaySlides.value[displayIndex]
      if (slide) activeIndex.value = slide.realIndex
    }
    updateCoverflow()
    scrollRaf = null
  })

  if (!isDragging) scheduleSettle()
}

function goPrev() {
  const displayIndex = getDisplayIndexFromScroll()
  scrollToDisplayIndex(displayIndex - 1)
  restartSegmentAnimation()
}

function goNext() {
  const displayIndex = getDisplayIndexFromScroll()
  scrollToDisplayIndex(displayIndex + 1)
  restartSegmentAnimation()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  }
}

function onCardClick(displayIndex: number, event: MouseEvent) {
  if (dragMoved) return
  if ((event.target as HTMLElement).closest('a')) return

  const currentDisplay = getDisplayIndexFromScroll()
  if (displayIndex !== currentDisplay) {
    scrollToDisplayIndex(displayIndex)
    restartSegmentAnimation()
  }
}

function onPointerDown(event: PointerEvent) {
  const track = trackRef.value
  if (!track || event.button !== 0) return
  if ((event.target as HTMLElement).closest('a, button')) return

  isDragging.value = true
  dragMoved = false
  dragStartX = event.clientX
  dragStartScrollLeft = track.scrollLeft
  track.setPointerCapture(event.pointerId)
  pauseAutoplay()
}

function onPointerMove(event: PointerEvent) {
  const track = trackRef.value
  if (!track || !isDragging.value) return

  const delta = event.clientX - dragStartX
  if (Math.abs(delta) > 4) dragMoved = true
  track.scrollLeft = dragStartScrollLeft - delta
  updateCoverflow()
}

function onPointerUp(event: PointerEvent) {
  const track = trackRef.value
  if (!track || !isDragging.value) return

  isDragging.value = false
  if (track.hasPointerCapture(event.pointerId)) {
    track.releasePointerCapture(event.pointerId)
  }
  scheduleSettle()
  resumeAutoplay()
}

function restartSegmentAnimation() {
  const fills = document.querySelectorAll<HTMLElement>('.features-carousel__segment--active .features-carousel__segment-fill')
  fills.forEach((fill) => {
    fill.style.animation = 'none'
    void fill.offsetWidth
    fill.style.animation = ''
  })
}

function startAutoplay() {
  if (prefersReducedMotion.value || autoplayTimer) return

  autoplayTimer = setInterval(() => {
    if (autoplayPaused.value) return
    goNext()
  }, 5000)
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

function pauseAutoplay() {
  autoplayPaused.value = true
}

function resumeAutoplay() {
  autoplayPaused.value = false
}

function onFocusOut(event: FocusEvent) {
  const region = carouselRegionRef.value
  if (!region) return
  const related = event.relatedTarget as Node | null
  if (!related || !region.contains(related)) {
    resumeAutoplay()
  }
}

function onReducedMotionChange(event: MediaQueryListEvent | MediaQueryList) {
  prefersReducedMotion.value = event.matches
  if (event.matches) {
    stopAutoplay()
    updateCoverflow()
  } else {
    startAutoplay()
    updateCoverflow()
  }
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = reducedMotionQuery.matches
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)

  requestAnimationFrame(() => {
    scrollToDisplayIndex(1, 'auto')
    activeIndex.value = 0
    updateCoverflow()
    startAutoplay()
  })
})

onUnmounted(() => {
  stopAutoplay()
  reducedMotionQuery?.removeEventListener('change', onReducedMotionChange)
  if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
  if (coverflowRaf !== null) cancelAnimationFrame(coverflowRaf)
  if (settleTimer) clearTimeout(settleTimer)
})
</script>

<style scoped>
.features-heading {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--color-text);
}

.features-carousel {
  position: relative;
}

.features-carousel__controls {
  display: none;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

@media (min-width: 768px) {
  .features-carousel__controls {
    display: flex;
  }
}

.features-carousel__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition:
    border-color 0.22s ease,
    background-color 0.22s ease,
    transform 0.15s ease;
}

.features-carousel__nav:hover {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
  transform: translateY(-2px);
}

.features-carousel__track {
  display: flex;
  gap: 1.25rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 1.5rem;
  padding: 1rem 0 1.25rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
}

.features-carousel__track::-webkit-scrollbar {
  display: none;
}

.features-carousel__track--dragging {
  cursor: grabbing;
  scroll-snap-type: none;
  user-select: none;
}

.features-carousel__card {
  flex: 0 0 min(380px, calc(100vw - 3rem));
  scroll-snap-align: center;
  display: flex;
  flex-direction: column;
  border-radius: 1.5rem;
  padding: 1.75rem;
  min-height: 320px;
  transform-origin: center center;
  will-change: transform, opacity;
  cursor: pointer;
}

.features-carousel__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 1.25rem;
  border-radius: 1rem;
  background: rgba(52, 65, 143, 0.08);
}

html.dark .features-carousel__icon {
  background: rgba(222, 172, 75, 0.1);
}

.features-carousel__icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.features-carousel__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.22s ease, gap 0.22s ease;
}

.features-carousel__cta:hover {
  color: var(--color-accent);
  gap: 0.5rem;
}

.features-carousel__indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  margin-top: 1.25rem;
}

.features-carousel__index {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
}

.features-carousel__segments {
  display: flex;
  gap: 0.4rem;
  width: min(280px, 100%);
}

.features-carousel__segment {
  flex: 1;
  height: 3px;
  border: none;
  padding: 0;
  border-radius: 9999px;
  background: var(--color-border);
  overflow: hidden;
  cursor: pointer;
}

.features-carousel__segment-fill {
  display: block;
  width: 0%;
  height: 100%;
  background: var(--color-accent);
  border-radius: inherit;
}

.features-carousel__segment--active .features-carousel__segment-fill {
  width: 100%;
  animation: segment-progress 5s linear forwards;
}

.features-carousel__segment--active.features-carousel__segment--paused .features-carousel__segment-fill {
  animation-play-state: paused;
}

@keyframes segment-progress {
  from { width: 0%; }
  to { width: 100%; }
}

.features-carousel:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 4px;
  border-radius: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .features-carousel__card {
    transform: none !important;
    opacity: 1 !important;
  }

  .features-carousel__segment--active .features-carousel__segment-fill {
    animation: none;
    width: 100%;
  }
}
</style>

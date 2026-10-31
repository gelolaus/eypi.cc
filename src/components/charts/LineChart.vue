<script setup lang="ts">
import { computed } from 'vue'
import { linearScale, niceTicks } from './scale'

const props = defineProps<{
  series: { label: string; points: { x: string; y: number }[] }[]
  yLabel: string
}>()
const W = 640
const H = 240
const M = { l: 40, r: 12, t: 12, b: 28 }
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const dashes = ['none', '6 4', '2 3', '10 3 2 3', '1 4']
const shapes = ['circle', 'square', 'diamond', 'triangle', 'cross'] as const
function marker(shape: string, cx: number, cy: number): string {
  const r = 4
  if (shape === 'square') return `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`
  if (shape === 'diamond') return `M${cx} ${cy - r - 1}L${cx + r + 1} ${cy}L${cx} ${cy + r + 1}L${cx - r - 1} ${cy}z`
  if (shape === 'triangle') return `M${cx} ${cy - r}L${cx + r} ${cy + r}L${cx - r} ${cy + r}z`
  if (shape === 'cross') return `M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx - r} ${cy + r}L${cx + r} ${cy - r}`
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
}
const markerPaths = computed(() =>
  props.series.map((s, si) => {
    const sh = shapes[si % shapes.length]
    const every = Math.max(1, Math.ceil(s.points.length / 8))
    return s.points
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => s.points.length === 1 || i % every === 0)
      .map(({ p, i }) => marker(sh, xScale.value(i), yScale.value(p.y)))
      .join('')
  }),
)

const labels = computed(() => props.series[0]?.points.map((p) => p.x) ?? [])
const ticks = computed(() => niceTicks(Math.max(0, ...props.series.flatMap((s) => s.points.map((p) => p.y)))))
const yScale = computed(() => linearScale([0, ticks.value[ticks.value.length - 1]], [H - M.b, M.t]))
const xScale = computed(() => linearScale([0, Math.max(1, labels.value.length - 1)], [M.l, W - M.r]))
const paths = computed(() =>
  props.series.map((s) => s.points.map((p, i) => `${i ? 'L' : 'M'}${xScale.value(i).toFixed(1)} ${yScale.value(p.y).toFixed(1)}`).join(' ')),
)
const ariaLabel = computed(() => `${props.yLabel}: ${props.series.map((s) => s.label).join(', ')}`)
const xTicks = computed(() => {
  const n = labels.value.length
  const step = Math.max(1, Math.ceil(n / 6))
  return labels.value.map((l, i) => ({ l, i })).filter((t) => t.i % step === 0)
})
</script>

<template>
  <figure class="w-full">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="ariaLabel"
      class="w-full"
    >
      <g
        class="text-muted-foreground"
        font-size="11"
        fill="currentColor"
      >
        <g
          v-for="t in ticks"
          :key="t"
        >
          <line
            :x1="M.l"
            :x2="W - M.r"
            :y1="yScale(t)"
            :y2="yScale(t)"
            stroke="var(--border)"
            stroke-width="1"
          />
          <text
            :x="M.l - 6"
            :y="yScale(t) + 4"
            text-anchor="end"
          >{{ t }}</text>
        </g>
        <text
          v-for="t in xTicks"
          :key="t.i"
          :x="xScale(t.i)"
          :y="H - 8"
          text-anchor="middle"
        >{{ t.l }}</text>
      </g>
      <path
        v-for="(d, i) in paths"
        :key="i"
        :d="d"
        fill="none"
        :stroke="colors[i % colors.length]"
        stroke-width="2"
        :stroke-dasharray="dashes[i % dashes.length]"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-for="(d, i) in markerPaths"
        :key="`m${i}`"
        :d="d"
        :data-marker="shapes[i % shapes.length]"
        :fill="shapes[i % shapes.length] === 'cross' ? 'none' : colors[i % colors.length]"
        :stroke="colors[i % colors.length]"
        stroke-width="1.5"
      />
    </svg>
    <ul
      v-if="series.length > 1"
      class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
    >
      <li
        v-for="(s, i) in series"
        :key="s.label"
        class="flex items-center gap-1.5"
      >
        <svg
          viewBox="0 0 28 10"
          class="h-2.5 w-7"
          aria-hidden="true"
        >
          <line
            x1="1"
            x2="27"
            y1="5"
            y2="5"
            :stroke="colors[i % colors.length]"
            stroke-width="2"
            :stroke-dasharray="dashes[i % dashes.length]"
          />
          <path
            :d="marker(shapes[i % shapes.length], 14, 5)"
            :fill="shapes[i % shapes.length] === 'cross' ? 'none' : colors[i % colors.length]"
            :stroke="colors[i % colors.length]"
            stroke-width="1"
            transform="scale(.9) translate(1.5 .5)"
          />
        </svg>
        {{ s.label }}
      </li>
    </ul>
    <div class="sr-only">
      <table>
        <caption>{{ ariaLabel }}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span class="sr-only">Period</span>
            </th><th
              v-for="s in series"
              :key="s.label"
              scope="col"
            >
              {{ s.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(x, i) in labels"
            :key="x"
          >
            <th scope="row">
              {{ x }}
            </th>
            <td
              v-for="s in series"
              :key="s.label"
            >
              {{ s.points[i]?.y }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

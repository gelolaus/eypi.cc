<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ cells: number[]; label: string }>()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const valid = computed(() => props.cells.length === 168)
if (!valid.value && import.meta.env.DEV) console.warn(`HeatGrid expects 168 cells (7 days x 24 hours), got ${props.cells.length}`)
const peak = computed(() => Math.max(1, ...props.cells))
function opacity(v: number): number {
  return v <= 0 ? 0.06 : 0.15 + 0.85 * (v / peak.value)
}
const hours = Array.from({ length: 24 }, (_, h) => h)
</script>

<template>
  <div v-if="valid">
    <svg
      viewBox="0 0 264 80"
      role="img"
      :aria-label="label"
      class="w-full"
    >
      <g
        v-for="(v, i) in cells"
        :key="i"
      >
        <rect
          :x="(i % 24) * 11"
          :y="Math.floor(i / 24) * 11"
          width="9"
          height="9"
          rx="2"
          fill="var(--chart-1)"
          :fill-opacity="opacity(v)"
        />
      </g>
    </svg>
    <div class="sr-only">
      <table>
        <caption>{{ label }}</caption>
        <thead>
          <tr>
            <th scope="col">
              Day
            </th><th
              v-for="h in hours"
              :key="h"
              scope="col"
            >
              {{ h }}:00
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(d, di) in DAYS"
            :key="d"
          >
            <th scope="row">
              {{ d }}
            </th>
            <td
              v-for="h in hours"
              :key="h"
            >
              {{ cells[di * 24 + h] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

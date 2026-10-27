<script setup lang="ts">
import { computed } from 'vue'
import { linearScale } from './scale'

const props = defineProps<{ values: number[]; label: string }>()
const W = 120
const H = 32
const path = computed(() => {
  const v = props.values
  if (!v.length) return ''
  const x = linearScale([0, Math.max(1, v.length - 1)], [2, W - 2])
  const y = linearScale([Math.min(...v, 0), Math.max(...v, 1)], [H - 2, 2])
  return v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(' ')
})
</script>

<template>
  <div>
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label" class="h-8 w-full" preserveAspectRatio="none">
      <path :d="path" fill="none" stroke="var(--chart-1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
    <table class="sr-only">
      <caption>{{ label }}</caption>
      <tbody>
        <tr v-for="(v, i) in values" :key="i"><th scope="row">{{ i + 1 }}</th><td>{{ v }}</td></tr>
      </tbody>
    </table>
  </div>
</template>

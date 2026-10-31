<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ items: { label: string; value: number }[]; max?: number }>()
const top = computed(() => Math.max(1, props.max ?? Math.max(0, ...props.items.map((i) => i.value))))
const ariaLabel = computed(() => `Bar list: ${props.items.map((i) => `${i.label} ${i.value}`).join(', ')}`)
</script>

<template>
  <div>
    <ul
      role="img"
      :aria-label="ariaLabel"
      class="space-y-2"
    >
      <li
        v-for="item in items"
        :key="item.label"
        aria-hidden="true"
      >
        <div class="mb-1 flex justify-between gap-2 text-sm">
          <span class="truncate">{{ item.label }}</span>
          <span class="tabular-nums text-muted-foreground">{{ item.value }}</span>
        </div>
        <div class="h-2 rounded-full bg-muted">
          <div
            class="h-2 rounded-full"
            :style="{ width: `${Math.max(0, Math.min(100, (item.value / top) * 100))}%`, background: 'var(--chart-1)' }"
          />
        </div>
      </li>
    </ul>
    <div class="sr-only">
      <table>
        <caption>{{ ariaLabel }}</caption>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.label"
          >
            <th scope="row">
              {{ item.label }}
            </th><td>{{ item.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Copy } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import PanelState from '@/components/dashboard/PanelState.vue'
import { copyShortLink } from '@/lib/copyShortLink'
import type { UserTrends } from '@/lib/queries'

const props = defineProps<{
  trends: UserTrends | null
  status: 'loading' | 'error' | 'ready'
}>()
const emit = defineEmits<{ retry: [] }>()

const items = computed(() => (props.trends?.top.links ?? []).slice(0, 5))

const top = computed(() => Math.max(1, ...items.value.map((l) => l.clicks), 0))

const ariaLabel = computed(() =>
  `Bar list: ${items.value.map((l) => `eypi.cc/${l.slug} ${l.clicks}`).join(', ')}`,
)

const panelStatus = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (props.status === 'error') return 'error'
  if (props.status !== 'ready' || !props.trends) return 'loading'
  if (props.trends.totals.links === 0) return 'empty'
  if (items.value.length === 0) return 'empty'
  return 'ready'
})

const emptyBody = computed(() => {
  if (props.trends && props.trends.totals.links === 0) return 'No links yet'
  return 'No clicks in this period'
})

const action = computed(() => {
  if (props.trends && props.trends.totals.links === 0) {
    return { label: 'Create a link', to: '/links' }
  }
  return undefined
})

async function onCopy(slug: string) {
  await copyShortLink(slug)
}
</script>

<template>
  <PanelState
    :status="panelStatus"
    title="Top links"
    :empty-body="emptyBody"
    :action="action"
    @retry="emit('retry')"
  >
    <div>
      <ul
        class="space-y-2"
        :aria-label="ariaLabel"
      >
        <li
          v-for="item in items"
          :key="item.slug"
          data-top-link
        >
          <div class="mb-1 flex items-center justify-between gap-2 text-sm">
            <span class="min-w-0 truncate">eypi.cc/{{ item.slug }}</span>
            <div class="flex shrink-0 items-center gap-1">
              <span class="tabular-nums text-muted-foreground">{{ item.clicks }}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                :aria-label="`Copy eypi.cc/${item.slug}`"
                @click="onCopy(item.slug)"
              >
                <Copy aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div
            class="h-2 rounded-full bg-muted"
            aria-hidden="true"
          >
            <div
              class="h-2 rounded-full"
              :style="{ width: `${Math.max(0, Math.min(100, (item.clicks / top) * 100))}%`, background: 'var(--chart-1)' }"
            />
          </div>
        </li>
      </ul>
      <table class="sr-only">
        <caption>{{ ariaLabel }}</caption>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.slug"
          >
            <th scope="row">
              eypi.cc/{{ item.slug }}
            </th>
            <td>{{ item.clicks }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </PanelState>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BarList from '@/components/charts/BarList.vue'
import LineChart from '@/components/charts/LineChart.vue'
import StatTile from '@/components/charts/StatTile.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'

type Payload = {
  byStatus: { status: string; n: number }[]
  registrationsDaily: { day: string; n: number }[]
  byAnswer: { questionId: string; options: { value: string; n: number }[] }[]
  showUpRate: number | null
  checkInCurve: { bucket: string; n: number }[]
}

const props = defineProps<{
  slug: string
  publicPath: string
  questions?: { id: string; label: string }[]
}>()

const data = ref<Payload | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await api.get<Payload>(`/api/events/${props.slug}/insights`)
  } catch {
    error.value = 'Could not load insights. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}

watch(() => props.slug, () => { if (props.slug) void load() }, { immediate: true })

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  entered: 'Entered',
  waitlisted: 'Waitlisted',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}
const total = computed(() => (data.value?.byStatus ?? []).reduce((sum, s) => sum + s.n, 0))
const confirmed = computed(() => data.value?.byStatus.find((s) => s.status === 'confirmed')?.n ?? 0)
const showUp = computed(() => (data.value?.showUpRate == null ? 'No data' : `${Math.round(data.value.showUpRate * 1000) / 10}%`))
const statusItems = computed(() => (data.value?.byStatus ?? []).map((s) => ({ label: STATUS_LABELS[s.status] ?? s.status, value: s.n })))
const registrations = computed(() => [{
  label: 'Registrations',
  points: (data.value?.registrationsDaily ?? []).map((d) => ({ x: d.day.slice(5), y: d.n })),
}])
const curve = computed(() => [{
  label: 'Check-ins',
  points: (data.value?.checkInCurve ?? []).map((d) => ({ x: d.bucket, y: d.n })),
}])
const answers = computed(() => (data.value?.byAnswer ?? []).map((q) => ({
  id: q.questionId,
  label: props.questions?.find((x) => x.id === q.questionId)?.label ?? q.questionId,
  items: q.options.map((o) => ({ label: o.value, value: o.n })),
})))
</script>

<template>
  <section
    class="space-y-6"
    aria-label="Tix insights"
  >
    <p
      v-if="loading && !data"
      role="status"
      class="text-sm text-muted-foreground"
    >
      Loading insights
    </p>

    <Card
      v-else-if="error"
      class="gap-3 rounded-3xl p-6 text-center"
    >
      <p
        role="alert"
        class="text-base text-destructive"
      >
        {{ error }}
      </p>
      <div>
        <Button
          type="button"
          variant="outline"
          @click="load"
        >
          Try again
        </Button>
      </div>
    </Card>

    <Card
      v-else-if="data && total === 0"
      class="items-center gap-4 rounded-3xl p-8 text-center"
    >
      <p class="text-base text-muted-foreground">
        No registrations yet. Share the event page so people can sign up.
      </p>
      <Button as-child>
        <router-link :to="publicPath">
          Open the event page
        </router-link>
      </Button>
    </Card>

    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Registrations"
          :value="String(total)"
        />
        <StatTile
          label="Confirmed"
          :value="String(confirmed)"
        />
        <StatTile
          label="Show-up rate"
          :value="showUp"
        />
      </div>

      <div>
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          By status
        </h3>
        <BarList :items="statusItems" />
      </div>

      <div v-if="data.registrationsDaily.length">
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Registrations per day (Manila time)
        </h3>
        <LineChart
          :series="registrations"
          y-label="Registrations"
        />
      </div>

      <div v-if="data.checkInCurve.length">
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          Check-ins by 10 minutes (Manila time)
        </h3>
        <LineChart
          :series="curve"
          y-label="Check-ins"
        />
      </div>

      <div
        v-for="question in answers"
        :key="question.id"
      >
        <h3 class="mb-3 text-sm font-semibold text-muted-foreground">
          {{ question.label }}
        </h3>
        <BarList :items="question.items" />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { appNav, groupedEntries } from '@/components/layout/appNav'
import { CARD_DESCRIPTIONS } from '@/config/dashboardCards'
import { useSession } from '@/stores/session'

const props = defineProps<{ admin: boolean; org: boolean; group?: 'rams' | 'orgs' }>()

const session = useSession()
const pendingInviteCount = computed(() => session.pendingInviteCount.value)

const groups = computed(() =>
  groupedEntries(appNav({ admin: props.admin, org: props.org }))
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => entry.to !== '/dashboard'),
    }))
    .filter((group) => group.entries.length > 0)
    .filter((group) => !props.group || group.group === props.group),
)
</script>

<template>
  <div class="space-y-6">
    <section
      v-for="group in groups"
      :key="group.group"
      :data-group="group.group"
      class="space-y-3"
    >
      <h3 class="text-xs font-medium text-muted-foreground">
        {{ group.label }}
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <router-link
          v-for="entry in group.entries"
          :key="entry.to"
          :to="entry.to"
          class="group/module block min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card class="h-full min-h-11 gap-2 p-6 text-left transition-colors group-active/module:translate-y-px [@media(hover:hover)_and_(pointer:fine)]:group-hover/module:bg-muted">
            <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
              {{ entry.label }}
              <Badge
                v-if="entry.to === '/invites' && pendingInviteCount > 0"
                variant="default"
              >
                {{ pendingInviteCount }}
              </Badge>
            </h2>
            <p class="text-base text-muted-foreground">
              {{ CARD_DESCRIPTIONS[entry.to] }}
            </p>
          </Card>
        </router-link>
      </div>
    </section>
  </div>
</template>
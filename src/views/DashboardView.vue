<template>
  <AppPage
    :title="userName ? `Hi, ${userName}.` : 'Hi.'"
    description="Your links, your org, and the platform at a glance."
  >
    <Card
      v-if="pendingInviteCount > 0"
      class="border border-primary/40 bg-primary/10 px-5 py-4 text-base text-foreground"
      role="status"
    >
      <p>
        {{ inviteBanner }}
        <router-link
          to="/invites"
          class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Review invites
        </router-link>
      </p>
    </Card>


    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div data-card="links">
        <AppSection title="Your links">
          <p
            v-if="linkSummary === 'error'"
            class="text-base text-muted-foreground"
          >
            Link totals are unavailable right now.
          </p>
          <p
            v-else-if="linkSummary && linkSummary.count === 0"
            class="text-base text-muted-foreground"
          >
            No links yet. Create your first short link.
            <router-link
              to="/links"
              class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
            >
              Open Links
            </router-link>
          </p>
          <dl
            v-else-if="linkSummary"
            class="grid grid-cols-2 gap-3"
          >
            <div class="flex flex-col-reverse rounded-2xl border border-border bg-muted/40 p-4">
              <dt class="text-sm text-muted-foreground">
                Links
              </dt>
              <dd class="font-heading text-3xl font-semibold tabular-nums">
                {{ linkSummary.count.toLocaleString('en-US') }}
              </dd>
            </div>
            <div class="flex flex-col-reverse rounded-2xl border border-border bg-muted/40 p-4">
              <dt class="text-sm text-muted-foreground">
                Clicks
              </dt>
              <dd class="font-heading text-3xl font-semibold tabular-nums">
                {{ linkSummary.clicks.toLocaleString('en-US') }}
              </dd>
            </div>
            <div
              v-if="linkSummary.top"
              class="col-span-2 min-w-0 rounded-2xl border border-border bg-muted/40 p-4"
            >
              <p class="text-sm text-muted-foreground">
                Top link
              </p>
              <p class="truncate font-mono text-base">
                eypi.cc/{{ linkSummary.top.slug }}
              </p>
              <p class="text-sm text-muted-foreground tabular-nums">
                {{ linkSummary.top.clicks.toLocaleString('en-US') }} clicks
              </p>
            </div>
          </dl>
        </AppSection>
      </div>

      <div
        v-if="activeOrg"
        data-card="org"
      >
        <AppSection title="Your org">
          <p class="line-clamp-2 break-words text-base font-medium">
            {{ activeOrg.org_name }}
          </p>
          <p class="mb-4 font-mono text-sm text-muted-foreground">
            {{ orgSlugLabel(activeOrg) }}
          </p>
          <p
            v-if="orgSummary === 'error'"
            class="text-base text-muted-foreground"
          >
            Org totals are unavailable right now.
          </p>
          <dl
            v-else-if="orgSummary"
            class="grid grid-cols-2 gap-3"
          >
            <div
              v-for="item in orgItems"
              :key="item.key"
              class="flex flex-col-reverse rounded-2xl border border-border bg-muted/40 p-4"
            >
              <dt class="text-sm text-muted-foreground">
                {{ item.label }}
              </dt>
              <dd class="font-heading text-3xl font-semibold tabular-nums">
                {{ orgSummary[item.key].toLocaleString('en-US') }}
              </dd>
            </div>
          </dl>
        </AppSection>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      <router-link
        v-for="mod in modules"
        :key="mod.id"
        :to="mod.route"
        class="group/module block min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card class="h-full min-h-11 gap-2 p-6 text-left transition-colors group-active/module:translate-y-px [@media(hover:hover)_and_(pointer:fine)]:group-hover/module:bg-muted">
          <h2 class="text-xl font-semibold tracking-tight text-foreground">
            {{ mod.title }}
          </h2>
          <p class="text-base text-muted-foreground">
            {{ mod.description }}
          </p>
        </Card>
      </router-link>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { LINKS_SUMMARY_KEY, fetchLinksSummary, fetchOrgSummary, orgSummaryKey, type LinkSummary, type OrgSummary } from '@/lib/queries'
import { useQuery } from '@/lib/queryCache'
import { useSession } from '@/stores/session'
import { orgSlugLabel } from '@/types/orgs'


const { activeOrg } = useActiveOrg()
const orgItems: { key: keyof OrgSummary; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'events', label: 'Events' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'frames', label: 'Frames' },
]

const linkQuery = useQuery(LINKS_SUMMARY_KEY, fetchLinksSummary)
const orgQuery = useQuery(
  () => (activeOrg.value?.org_id ? orgSummaryKey(activeOrg.value.org_id) : ''),
  () => fetchOrgSummary(activeOrg.value?.org_id ?? ''),
)
const linkSummary = computed<LinkSummary | 'error' | null>(() =>
  linkQuery.status.value === 'error' ? 'error' : linkQuery.data.value ?? null)
const orgSummary = computed<OrgSummary | 'error' | null>(() =>
  orgQuery.status.value === 'error' ? 'error' : orgQuery.data.value ?? null)

const session = useSession()

const userName = computed(() => session.user.value?.name ?? '')
const pendingInviteCount = computed(() => session.pendingInviteCount.value)
const inviteBanner = computed(() => {
  const count = pendingInviteCount.value
  const noun = count === 1 ? 'invite' : 'invites'
  return `You have ${count} pending org ${noun}.`
})

const modules = [
  {
    id: 'links',
    title: 'Links',
    description: 'Shorten URLs and track click analytics by OS, country, and referrer.',
    route: '/links',
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Generate MOAs, letters of intent, and printable event documents.',
    route: '/forms',
  },
  {
    id: 'ticketing',
    title: 'Tix',
    description: 'Create events, manage guest lists, and run QR-code check-in.',
    route: '/manage/tix',
  },
  {
    id: 'frames',
    title: 'Frames',
    description: 'Upload a frame and share a link so anyone can make a matching profile picture.',
    route: '/manage/frames',
  },
  {
    id: 'orgs',
    title: 'Orgs',
    description: 'Edit your organization profile, manage members, and control public directory visibility.',
    route: '/orgs',
  },
]
</script>

<template>
  <button
    v-if="isPhone"
    ref="phoneTrigger"
    type="button"
    :data-account-menu="variant"
    :aria-label="triggerLabel"
    aria-haspopup="dialog"
    :aria-expanded="sheetOpen ? 'true' : 'false'"
    :aria-controls="sheetOpen ? menuId : undefined"
    :class="triggerClass"
    @click="onPhoneTrigger"
  >
    <UserAvatar
      :name="displayName"
      :icon="session.user.value?.avatarIcon"
      :color="session.user.value?.avatarColor"
      :class="header ? 'size-8' : collapsed ? 'size-9' : 'size-11'"
    />
    <span
      v-if="!header && !collapsed"
      class="min-w-0 flex-1"
    >
      <span class="line-clamp-2 text-base font-semibold leading-snug tracking-tight">{{ displayName }}</span>
    </span>
    <ChevronDown
      v-else-if="header"
      aria-hidden="true"
      class="size-4 shrink-0 text-muted-foreground"
    />
    <span
      v-if="header && inviteCount > 0"
      class="pointer-events-none absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-primary"
      aria-hidden="true"
    />
  </button>
  <BottomSheet
    v-if="isPhone"
    :id="menuId"
    v-model:open="sheetOpen"
    title="Account"
    :restore-focus="restoreSheetFocus"
  >
    <div
      data-sheet-identity
      class="flex items-center gap-3 px-2 py-3"
    >
      <UserAvatar
        :name="displayName"
        :icon="session.user.value?.avatarIcon"
        :color="session.user.value?.avatarColor"
        class="size-12 shrink-0"
      />
      <div class="min-w-0">
        <p class="truncate text-base font-semibold tracking-tight">
          {{ displayName }}
        </p>
        <p
          v-if="email"
          class="truncate text-sm text-muted-foreground"
        >
          {{ email }}
        </p>
      </div>
    </div>
    <template
      v-for="row in rows"
      :key="rowKey(row)"
    >
      <p
        v-if="row.kind === 'heading'"
        data-sheet-heading
        :class="sectionHeading"
      >
        {{ row.label }}
      </p>
      <router-link
        v-else-if="row.kind === 'link'"
        :to="row.entry.to"
        :class="sheetRow"
        :aria-current="currentPage(row.entry)"
        @click="onSheetNavigate"
      >
        <component
          :is="row.entry.icon"
          aria-hidden="true"
          class="size-4 shrink-0"
        />
        <span class="min-w-0 flex-1 truncate">{{ row.entry.label }}</span>
        <Badge
          v-if="row.entry.to === '/invites' && inviteCount > 0"
          :aria-label="inviteLabel"
        >
          {{ inviteCount }}
        </Badge>
      </router-link>
      <button
        v-else-if="row.kind === 'avatar'"
        type="button"
        :class="sheetRow"
        @click="onSheetAvatar"
      >
        <Smile
          aria-hidden="true"
          class="size-4 shrink-0"
        />
        Change avatar
      </button>
      <template v-else-if="row.kind === 'appearance'">
        <p
          data-sheet-heading
          :class="sectionHeading"
        >
          Appearance
        </p>
        <div
          role="radiogroup"
          aria-label="Theme"
          class="flex flex-col"
        >
          <button
            v-for="option in themeOptions"
            :key="option.mode"
            type="button"
            role="radio"
            :class="cn(sheetRow, preference.mode === option.mode && 'font-semibold')"
            :aria-checked="preference.mode === option.mode ? 'true' : 'false'"
            @click="setMode(option.mode)"
          >
            {{ option.label }}
          </button>
        </div>
        <button
          v-if="isDark"
          type="button"
          :class="sheetRow"
          :aria-pressed="preference.black ? 'true' : 'false'"
          @click="setBlack(!preference.black)"
        >
          True black
        </button>
      </template>
      <button
        v-else-if="row.kind === 'install'"
        type="button"
        :class="sheetRow"
        @click="onSheetInstall"
      >
        <Download
          aria-hidden="true"
          class="size-4 shrink-0"
        />
        Install Eypi
      </button>
      <router-link
        v-else-if="row.kind === 'legal'"
        :to="row.to"
        :class="sheetRow"
        @click="onSheetNavigate"
      >
        {{ row.label }}
      </router-link>
      <button
        v-else-if="row.kind === 'signout'"
        type="button"
        :class="cn(sheetRow, 'text-destructive')"
        @click="onSheetSignOut"
      >
        <LogOut
          aria-hidden="true"
          class="size-4 shrink-0"
        />
        Sign out
      </button>
    </template>
  </BottomSheet>
  <DropdownMenu v-else>
    <DropdownMenuTrigger
      :data-account-menu="variant"
      :aria-label="triggerLabel"
      aria-haspopup="menu"
      :class="triggerClass"
    >
      <UserAvatar
        :name="displayName"
        :icon="session.user.value?.avatarIcon"
        :color="session.user.value?.avatarColor"
        :class="header ? 'size-8' : collapsed ? 'size-9' : 'size-11'"
      />
      <span
        v-if="!header && !collapsed"
        class="min-w-0 flex-1"
      >
        <span class="line-clamp-2 text-base font-semibold leading-snug tracking-tight">{{ displayName }}</span>
      </span>
      <ChevronDown
        v-else-if="header"
        aria-hidden="true"
        class="size-4 shrink-0 text-muted-foreground"
      />
      <span
        v-if="header && inviteCount > 0"
        class="pointer-events-none absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-primary"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :align="header ? 'end' : 'start'"
      :side="header ? 'bottom' : 'top'"
      class="w-72 min-w-72 p-2 sm:w-72"
    >
      <div class="flex items-center gap-3 px-2 py-3">
        <UserAvatar
          :name="displayName"
          :icon="session.user.value?.avatarIcon"
          :color="session.user.value?.avatarColor"
          class="size-12 shrink-0"
        />
        <div class="min-w-0">
          <p class="truncate text-base font-semibold tracking-tight">
            {{ displayName }}
          </p>
          <p
            v-if="email"
            class="truncate text-sm text-muted-foreground"
          >
            {{ email }}
          </p>
        </div>
      </div>
      <DropdownMenuSeparator />
      <template
        v-for="(row, index) in rows"
        :key="rowKey(row)"
      >
        <p
          v-if="row.kind === 'heading'"
          data-sheet-heading
          :class="sectionHeading"
        >
          {{ row.label }}
        </p>
        <DropdownMenuItem
          v-else-if="row.kind === 'link'"
          as-child
          class="rounded-xl px-3 py-3 text-base"
        >
          <router-link
            :to="row.entry.to"
            :aria-current="currentPage(row.entry)"
          >
            <component
              :is="row.entry.icon"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ row.entry.label }}</span>
            <Badge
              v-if="row.entry.to === '/invites' && inviteCount > 0"
              :aria-label="inviteLabel"
            >
              {{ inviteCount }}
            </Badge>
          </router-link>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-else-if="row.kind === 'avatar'"
          class="min-h-11 rounded-xl px-3 py-3 text-base"
          @select="avatarOpen = true"
        >
          <Smile aria-hidden="true" />
          Change avatar
        </DropdownMenuItem>
        <ThemeMenuItems v-else-if="row.kind === 'appearance'" />
        <DropdownMenuItem
          v-else-if="row.kind === 'install'"
          class="min-h-11 rounded-xl px-3 py-3 text-base"
          @select="install"
        >
          <Download aria-hidden="true" />
          Install Eypi
        </DropdownMenuItem>
        <DropdownMenuItem
          v-else-if="row.kind === 'legal'"
          as-child
          class="rounded-xl px-3 py-3 text-base"
        >
          <router-link :to="row.to">
            {{ row.label }}
          </router-link>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-else-if="row.kind === 'signout'"
          variant="destructive"
          class="rounded-xl px-3 py-3 text-base"
          @select="signOut"
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="separatorAfter(index)" />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
  <AvatarPicker
    v-model:open="avatarOpen"
    @update:open="onAvatarOpen"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Download, LogOut, Smile } from 'lucide-vue-next'
import AvatarPicker from '@/components/avatar/AvatarPicker.vue'
import UserAvatar from '@/components/avatar/UserAvatar.vue'
import { Badge } from '@/components/ui/badge'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ThemeMenuItems from '@/components/theme/ThemeMenuItems.vue'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { useTheme } from '@/composables/useTheme'
import { GROUP_LABELS } from '@/config/nav'
import { cn } from '@/lib/cn'
import { useSession } from '@/stores/session'
import type { ThemeMode } from '@/theme/theme'
import { isAppNavEntryActive, menuEntries, type AppNavEntry } from './appNav'
import { useSignOut } from './useSignOut'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: 'sidebar' | 'header'
    /** Show the avatar only (collapsed side rail). */
    collapsed?: boolean
    /** Rams items that do not fit in the bottom tabs. Header menu only. */
    overflow?: AppNavEntry[]
    /** Orgs tools. Empty hides the Orgs heading. Header menu only. */
    orgEntries?: AppNavEntry[]
  }>(),
  { variant: 'sidebar', collapsed: false, overflow: () => [], orgEntries: () => [] },
)

/** Same breakpoint as `BottomSheet`: below Tailwind `sm`. */
const PHONE_QUERY = '(max-width: 639px)'

function useIsPhone(): Ref<boolean> {
  const phone = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return phone
  const mql = window.matchMedia(PHONE_QUERY)
  const sync = () => {
    phone.value = mql.matches
  }
  sync()
  mql.addEventListener?.('change', sync)
  onBeforeUnmount(() => mql.removeEventListener?.('change', sync))
  return phone
}

type MenuRow =
  | { kind: 'heading'; label: string }
  | { kind: 'link'; entry: AppNavEntry; section: 'rams' | 'orgs' | 'account' }
  | { kind: 'avatar' }
  | { kind: 'appearance' }
  | { kind: 'install' }
  | { kind: 'legal'; to: string; label: string }
  | { kind: 'signout' }

const legalLinks = [
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

const themeOptions: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

const sheetRow =
  'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-base outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50'
const sectionHeading = 'px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground'

const session = useSession()
const route = useRoute()
const signOut = useSignOut()
const { canInstall, install } = useInstallPrompt()
const { preference, isDark, setMode, setBlack } = useTheme()
const isPhone = useIsPhone()
const menuId = useId()
const phoneTrigger = ref<HTMLButtonElement | null>(null)
const sheetOpen = ref(false)
/** False only while Change avatar is handing focus to the picker. */
const restoreSheetFocus = ref(true)
/** Lives outside the menu content so it survives the menu closing. */
const avatarOpen = ref(false)

const accountEntries = computed(() => menuEntries({ admin: session.user.value?.role === 'admin' }))
const header = computed(() => props.variant === 'header')
const email = computed(() => session.user.value?.email ?? '')
const inviteCount = computed(() => session.pendingInviteCount.value)
const inviteLabel = computed(() => `${inviteCount.value} pending ${inviteCount.value === 1 ? 'invite' : 'invites'}`)

const displayName = computed(() => {
  const current = session.user.value
  if (!current) return 'Account'
  const prefix = current.email ? current.email.split('@')[0] : ''
  const name = current.name?.trim()
  if (name && name.toLowerCase() !== prefix.toLowerCase()) return name
  return prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() : 'Student'
})

const triggerLabel = computed(() =>
  inviteCount.value > 0
    ? `${displayName.value} account menu, ${inviteLabel.value}`
    : `${displayName.value} account menu`,
)

const triggerClass = computed(() =>
  cn(
    'outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50',
    header.value
      ? 'relative flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-0.5 pr-2 hover:bg-muted'
      : 'flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-muted',
    props.collapsed && !header.value ? 'justify-center' : '',
  ),
)

/** One list for the phone sheet and the desktop menu. */
const rows = computed<MenuRow[]>(() => {
  const list: MenuRow[] = []
  if (header.value && props.overflow.length > 0) {
    list.push({ kind: 'heading', label: GROUP_LABELS.rams })
    for (const entry of props.overflow) list.push({ kind: 'link', entry, section: 'rams' })
  }
  if (header.value && props.orgEntries.length > 0) {
    list.push({ kind: 'heading', label: GROUP_LABELS.orgs })
    for (const entry of props.orgEntries) list.push({ kind: 'link', entry, section: 'orgs' })
  }
  for (const entry of accountEntries.value) list.push({ kind: 'link', entry, section: 'account' })
  list.push({ kind: 'avatar' })
  list.push({ kind: 'appearance' })
  if (canInstall.value) list.push({ kind: 'install' })
  for (const link of legalLinks) list.push({ kind: 'legal', to: link.to, label: link.label })
  list.push({ kind: 'signout' })
  return list
})

function rowKey(row: MenuRow): string {
  if (row.kind === 'heading') return `heading:${row.label}`
  if (row.kind === 'link') return `link:${row.entry.to}`
  if (row.kind === 'legal') return `legal:${row.to}`
  return row.kind
}

function currentPage(entry: AppNavEntry): 'page' | undefined {
  return isAppNavEntryActive(entry, route.path) ? 'page' : undefined
}

/** Keeps the desktop separators where the previous menu had them, plus one around the new Orgs block. */
function separatorAfter(index: number): boolean {
  const row = rows.value[index]
  const next = rows.value[index + 1]
  if (!row || !next) return false
  if (row.kind === 'heading' || row.kind === 'avatar' || row.kind === 'signout') return false
  if (row.kind === 'link' && next.kind === 'link' && row.section === next.section) return false
  if (row.kind === 'legal' && next.kind === 'legal') return false
  return true
}

function onPhoneTrigger() {
  if (!sheetOpen.value) phoneTrigger.value?.focus()
  sheetOpen.value = !sheetOpen.value
}

function onSheetNavigate(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  sheetOpen.value = false
}

function onSheetAvatar() {
  restoreSheetFocus.value = false
  sheetOpen.value = false
  avatarOpen.value = true
  void nextTick(() => {
    restoreSheetFocus.value = true
  })
}

function onSheetInstall() {
  sheetOpen.value = false
  void install()
}

function onSheetSignOut() {
  sheetOpen.value = false
  signOut()
}

/** The menu item that opened the dialog is gone by now, so hand focus back to the menu trigger. */
function onAvatarOpen(value: boolean) {
  if (value) return
  void nextTick(() => document.querySelector<HTMLElement>(`[data-account-menu="${props.variant}"]`)?.focus())
}
</script>

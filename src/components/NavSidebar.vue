<template>
  <Teleport to="body">
    <Transition name="slide-over-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-slate-900/80"
        style="z-index: 99990"
        aria-hidden="true"
        @click="$emit('close')"
      />
    </Transition>

    <Transition name="slide-over-panel">
      <aside
        v-if="isOpen"
        id="site-nav-sidebar"
        ref="panelRef"
        class="nav-sidebar fixed right-0 top-0 flex h-dvh max-h-dvh w-full flex-col overflow-y-auto overscroll-contain border-l border-g-border bg-white/90 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-16 shadow-2xl backdrop-blur-xl dark:bg-slate-900/95 sm:max-w-md sm:px-8"
        style="z-index: 99991"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <button
          type="button"
          class="tap-scale absolute right-3 top-3 flex size-11 items-center justify-center rounded-xl font-mono text-2xl text-g-muted transition-colors hover:text-g-text sm:right-5"
          aria-label="Close navigation"
          data-cursor="nav"
          @click="$emit('close')"
        >
          &times;
        </button>

        <!-- Authenticated -->
        <template v-if="isAuthenticated">
          <div class="mb-6 rounded-2xl border border-g-border bg-g-bg/80 px-4 py-4 dark:bg-slate-950/50">
            <p class="text-base font-semibold text-g-primary dark:text-[#DEAC4B]">
              {{ userName }}
            </p>
            <p class="mt-1 truncate text-sm text-g-muted">
              {{ userEmail }}
            </p>
          </div>

          <nav class="flex flex-col" aria-label="App modules">
            <router-link
              v-for="link in appLinks"
              :key="link.to"
              :to="link.to"
              class="nav-sidebar-link tap-scale group"
              data-cursor="nav"
              @click="$emit('close')"
            >
              <span class="flex items-center gap-3">
                <span>{{ link.label }}</span>
                <span
                  v-if="link.to === '/invites' && pendingInviteCount > 0"
                  class="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#DEAC4B] px-1.5 text-xs font-semibold leading-none text-[#1a1a2e]"
                  :aria-label="pendingInviteLabel"
                >
                  {{ pendingInviteCount }}
                </span>
              </span>
              <span class="nav-sidebar-link__arrow" aria-hidden="true">↗</span>
            </router-link>
          </nav>

          <div v-if="orgs.length > 0" class="mt-8 pt-2">
            <p class="mb-3 text-sm font-medium text-g-muted">
              Active organization
            </p>
            <div class="flex flex-col gap-2">
              <button
                v-for="org in orgs"
                :key="org.org_id"
                type="button"
                class="tap-scale flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors"
                :class="
                  activeOrg?.org_id === org.org_id
                    ? 'border-[#DEAC4B]/50 bg-[#DEAC4B]/10 text-[#DEAC4B]'
                    : 'border-g-border text-g-text hover:border-g-primary/30 hover:bg-g-bg dark:hover:bg-slate-950/60'
                "
                data-cursor="nav"
                @click="$emit('selectOrg', org)"
              >
                <OrgLogo :logo-url="org.logo_url" :name="org.org_name" size="sm" />
                <span class="min-w-0 flex-1 truncate font-medium leading-snug">{{ org.org_name }}</span>
              </button>
            </div>
          </div>

          <div class="mt-auto pt-6">
            <button
              type="button"
              class="nav-sidebar-link nav-sidebar-link--danger tap-scale w-full"
              data-cursor="nav"
              @click="$emit('logout')"
            >
              <span>Logout</span>
              <span class="nav-sidebar-link__arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </template>

        <!-- Public -->
        <template v-else>
          <nav class="flex flex-col" aria-label="Public navigation">
            <router-link
              v-for="link in publicLinks"
              :key="link.to"
              :to="link.to"
              class="nav-sidebar-link tap-scale group"
              :class="link.cta ? 'nav-sidebar-link--cta' : ''"
              :data-cursor="link.cta ? 'cta' : 'nav'"
              @click="$emit('close')"
            >
              <span>{{ link.label }}</span>
              <span v-if="!link.cta" class="nav-sidebar-link__arrow" aria-hidden="true">↗</span>
            </router-link>
          </nav>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import OrgLogo from '@/components/OrgLogo.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { navItems } from '@/config/nav'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'

const props = defineProps<{
  isOpen: boolean
  isAuthenticated: boolean
  userName: string
  userEmail: string
  orgs: OrgListItem[]
  activeOrg: OrgListItem | null
}>()

defineEmits<{
  close: []
  selectOrg: [org: OrgListItem]
  logout: []
}>()

const session = useSession()

const appLinks = computed(() =>
  navItems({ authenticated: true, admin: session.user.value?.role === 'admin' }),
)
const publicLinks = navItems({ authenticated: false, admin: false })

const pendingInviteCount = computed(() => session.pendingInviteCount.value)
const pendingInviteLabel = computed(() => {
  const count = pendingInviteCount.value
  const noun = count === 1 ? 'invite' : 'invites'
  return `${count} pending ${noun}`
})

const panelRef = ref<HTMLElement | null>(null)
const { activate, release } = useFocusTrap(panelRef)

watch(
  () => props.isOpen,
  async (open) => {
    if (!open) {
      release()
      return
    }
    await nextTick()
    activate()
  },
)
</script>

<style scoped>
.nav-sidebar-link {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.25rem;
  border-bottom: 1px solid var(--color-border);
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--color-text);
  text-decoration: none;
  transition: color 0.22s ease;
}

.nav-sidebar-link:last-of-type {
  border-bottom: none;
}

.nav-sidebar-link__arrow {
  font-size: 0.85em;
  opacity: 0.45;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
}

@media (hover: hover) and (pointer: fine) {
  .nav-sidebar-link:hover {
    color: var(--color-accent);
  }

  .nav-sidebar-link:hover .nav-sidebar-link__arrow {
    opacity: 1;
    transform: translate(3px, -3px);
  }
}

.nav-sidebar-link--cta {
  margin-top: 0.75rem;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  background: var(--color-accent);
  color: #1a1a2e;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.nav-sidebar-link--cta:hover {
  color: #1a1a2e;
  opacity: 0.92;
}

.nav-sidebar-link--danger {
  border-bottom: 0;
  color: #dc2626;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-transform: none;
}

.nav-sidebar-link--danger:hover {
  color: #dc2626;
  opacity: 0.85;
}
</style>

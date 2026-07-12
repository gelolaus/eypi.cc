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

    <Transition name="slide-over-panel" @after-enter="onPanelEnter">
      <aside
        v-if="isOpen"
        id="site-nav-sidebar"
        class="nav-sidebar fixed top-0 right-0 flex h-full max-h-screen w-full flex-col overflow-y-auto border-l border-g-border bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:bg-slate-900/95 sm:max-w-md sm:p-8"
        style="z-index: 99991"
        aria-label="Site navigation"
        :class="itemsVisible ? 'nav-sidebar--visible' : ''"
      >
        <button
          type="button"
          class="tap-scale absolute right-6 top-6 font-mono text-2xl text-g-muted transition-colors hover:text-g-text"
          aria-label="Close navigation"
          data-cursor="nav"
          @click="$emit('close')"
        >
          &times;
        </button>

        <!-- Authenticated -->
        <template v-if="isAuthenticated">
          <div class="nav-sidebar-item mb-8 rounded-2xl border border-g-border bg-g-bg/80 px-4 py-4 dark:bg-slate-950/50">
            <p class="text-base font-semibold text-g-primary dark:text-[#DEAC4B]">
              {{ userName }}
            </p>
            <p class="mt-1 truncate text-sm text-g-muted">
              {{ userEmail }}
            </p>
          </div>

          <nav class="flex flex-col gap-1" aria-label="App modules">
            <router-link
              v-for="(link, index) in appLinks"
              :key="link.to"
              :to="link.to"
              class="nav-sidebar-item nav-sidebar-link tap-scale group"
              :style="{ transitionDelay: `${0.05 + index * 0.04}s` }"
              data-cursor="nav"
              @click="$emit('close')"
            >
              <span>{{ link.label }}</span>
              <span class="nav-sidebar-link__arrow" aria-hidden="true">↗</span>
            </router-link>
          </nav>

          <div v-if="orgs.length > 0" class="nav-sidebar-item mt-10 pt-2">
            <p class="mb-3 text-sm font-medium text-g-muted">
              Active organization
            </p>
            <div class="flex flex-col gap-2">
              <button
                v-for="org in orgs"
                :key="org.org_id"
                type="button"
                class="tap-scale flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors"
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

          <div class="nav-sidebar-item mt-auto pt-6">
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
          <nav class="flex flex-col gap-1" aria-label="Public navigation">
            <router-link
              v-for="(link, index) in publicLinks"
              :key="link.to"
              :to="link.to"
              class="nav-sidebar-item nav-sidebar-link tap-scale group"
              :class="link.variant === 'cta' ? 'nav-sidebar-link--cta' : ''"
              :style="{ transitionDelay: `${0.05 + index * 0.04}s` }"
              :data-cursor="link.variant === 'cta' ? 'cta' : 'nav'"
              @click="$emit('close')"
            >
              <span>{{ link.label }}</span>
              <span v-if="link.variant !== 'cta'" class="nav-sidebar-link__arrow" aria-hidden="true">↗</span>
            </router-link>
          </nav>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import OrgLogo from '@/components/OrgLogo.vue'
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

const appLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/links', label: 'Links' },
  { to: '/forms', label: 'Forms' },
  { to: '/manage/tix', label: 'Tix' },
  { to: '/manage/frames', label: 'Frames' },
  { to: '/orgs', label: 'Orgs' },
  { to: '/settings', label: 'Settings' },
]

const publicLinks = [
  { to: '/orgs', label: 'Orgs' },
  { to: '/login', label: 'Log in' },
  { to: '/login?tab=register', label: 'Sign up', variant: 'cta' as const },
]

const itemsVisible = ref(false)

function onPanelEnter() {
  itemsVisible.value = true
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) itemsVisible.value = false
  },
)
</script>

<style scoped>
.nav-sidebar-item {
  opacity: 0;
  transform: translateX(18px);
  transition:
    opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.nav-sidebar--visible .nav-sidebar-item {
  opacity: 1;
  transform: translateX(0);
}

.nav-sidebar-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.25rem;
  border-bottom: 1px solid var(--color-border);
  font-family: 'Geist', system-ui, sans-serif;
  font-size: clamp(1.1rem, 2.5vw, 1.45rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--color-text);
  text-decoration: none;
  transition:
    opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.22s ease;
}

.nav-sidebar-link:last-of-type {
  border-bottom: none;
}

.nav-sidebar-link:hover {
  color: var(--color-accent);
}

.nav-sidebar-link__arrow {
  font-size: 0.85em;
  opacity: 0.45;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
}

.nav-sidebar-link:hover .nav-sidebar-link__arrow {
  opacity: 1;
  transform: translate(3px, -3px);
}

.nav-sidebar-link--cta {
  margin-top: 0.75rem;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 9999px;
  background: var(--color-accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: none;
}

.nav-sidebar-link--cta:hover {
  color: #fff;
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

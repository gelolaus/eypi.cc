<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-6 py-16">
    <div class="mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1
          class="font-mono font-black tracking-tight text-g-primary dark:text-slate-200"
          style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.03em;"
          data-cursor="text"
        >
          Orgs
        </h1>
        <p class="mt-1 font-mono text-xs uppercase tracking-widest text-g-muted">
          Organization information &amp; members
        </p>
      </div>
      <div v-if="!isLocked" class="flex flex-wrap items-center gap-3">
        <OrgSwitcher navigate-path="/orgs/modify" />
      </div>
    </div>

    <div v-if="isLocked">
      <OrgLockout />
    </div>

    <div v-else-if="loading" class="space-y-4">
      <div class="h-10 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
      <div class="h-64 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <div v-else-if="error" class="mica-card rounded-3xl p-8 text-center font-mono text-sm text-red-500">
      {{ error }}
    </div>

    <template v-else-if="org && profileForm">
      <header class="mb-6 flex flex-col gap-3 border-b border-g-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex min-w-0 items-start gap-4">
          <OrgLogo
            :logo-url="profileForm.logoUrl"
            :name="org.org_name"
            size="md"
          />
          <div class="min-w-0">
            <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-g-accent">org settings</p>
            <h2 class="mt-2 font-mono text-2xl font-semibold leading-tight tracking-[0.04em] text-g-text break-words">{{ org.org_name }}</h2>
            <p class="mt-1 font-mono text-[0.65rem] lowercase tracking-normal text-g-muted">/orgs/{{ org.org_id }}</p>
          </div>
        </div>
        <span
          class="inline-flex w-fit rounded-full border px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em]"
          :class="isOwner ? 'border-g-accent/40 bg-g-accent/10 text-g-accent' : 'border-g-border text-g-muted'"
        >
          {{ isOwner ? 'Owner' : 'Member' }}
        </span>
      </header>

      <!-- Public directory profile -->
      <section class="mica-card mb-6 rounded-3xl p-6 sm:p-8">
        <div class="mb-6 flex flex-col gap-3 border-b border-g-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 class="font-mono text-lg font-semibold uppercase tracking-[0.1em] text-g-text">Public profile</h3>
            <p class="mt-1 font-mono text-xs text-g-muted">Shown on /orgs when listed in the directory.</p>
          </div>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-g-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-g-muted transition-colors hover:border-g-accent hover:text-g-accent"
            data-cursor="nav"
            @click="openPreview"
          >
            Preview ↗
          </button>
        </div>

        <div class="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-g-border bg-white/20 p-4 dark:bg-slate-900/20">
          <div>
            <p class="font-mono text-xs font-bold uppercase tracking-[0.12em] text-g-text">List in /orgs directory</p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="profileForm.isPublicCatalog"
            :disabled="togglingCatalog"
            class="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
            :class="profileForm.isPublicCatalog ? 'bg-g-accent' : 'bg-gray-300 dark:bg-slate-600'"
            @click="togglePublicCatalog"
          >
            <span
              class="pointer-events-none absolute left-0.5 top-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform"
              :class="profileForm.isPublicCatalog ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <form class="space-y-5" @submit.prevent="saveProfile">
          <div class="flex flex-col gap-2 font-mono">
            <label for="tagline" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Tagline</label>
            <input id="tagline" v-model="profileForm.tagline" type="text" maxlength="160" class="field-input" />
          </div>

          <div class="flex flex-col gap-2 font-mono">
            <label for="about" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">About (Markdown)</label>
            <textarea id="about" v-model="profileForm.aboutMarkdown" rows="6" maxlength="8000" class="field-input" />
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div class="flex flex-col gap-3 font-mono">
              <span class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Banner</span>
              <div
                class="relative h-28 overflow-hidden rounded-xl border border-g-border"
                :class="profileForm.bannerUrl ? '' : 'bg-gradient-to-br from-[#34418F] to-[#DEAC4B]'"
              >
                <img v-if="profileForm.bannerUrl" :src="profileForm.bannerUrl" alt="Banner preview" class="h-full w-full object-cover" />
              </div>
              <label class="cursor-pointer rounded-lg border-2 border-dashed border-g-border px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-g-muted transition-colors hover:border-g-accent hover:text-g-accent">
                {{ uploadingBanner ? 'Uploading...' : 'Upload banner' }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="uploadingBanner" @change="onBannerPicked" />
              </label>
              <button
                v-if="profileForm.bannerUrl"
                type="button"
                class="text-left text-[0.65rem] font-bold uppercase tracking-wider text-red-500"
                @click="profileForm.bannerUrl = ''"
              >
                Remove banner
              </button>
            </div>

            <div class="flex flex-col gap-3 font-mono">
              <span class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Logo</span>
              <div class="flex h-28 items-center justify-center">
                <div
                  v-if="profileForm.logoUrl"
                  class="h-24 w-24 overflow-hidden rounded-2xl border border-g-border"
                >
                  <img :src="profileForm.logoUrl" alt="Logo preview" class="h-full w-full object-cover" />
                </div>
                <div
                  v-else
                  class="flex h-24 w-24 items-center justify-center rounded-2xl border border-g-border bg-[#34418F]/10 font-mono text-lg font-bold text-[#34418F]"
                >
                  {{ orgInitials(org.org_name) }}
                </div>
              </div>
              <label class="cursor-pointer rounded-lg border-2 border-dashed border-g-border px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-g-muted transition-colors hover:border-g-accent hover:text-g-accent">
                {{ uploadingLogo ? 'Uploading...' : 'Upload logo' }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="uploadingLogo" @change="onLogoPicked" />
              </label>
              <button
                v-if="profileForm.logoUrl"
                type="button"
                class="text-left text-[0.65rem] font-bold uppercase tracking-wider text-red-500"
                @click="profileForm.logoUrl = ''"
              >
                Remove logo
              </button>
            </div>
          </div>

          <div>
            <p class="mb-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Social links</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="field in SOCIAL_FIELD_META" :key="field.key" class="flex flex-col gap-2 font-mono">
                <label :for="`social-${field.key}`" class="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-g-muted">{{ field.label }}</label>
                <div v-if="field.prefix" class="flex overflow-hidden rounded-lg border-2 border-gray-200 focus-within:border-g-primary dark:border-slate-600 dark:focus-within:border-slate-500">
                  <span class="flex shrink-0 items-center bg-white/50 px-3 text-[0.65rem] text-g-muted dark:bg-mica-navy-input">{{ field.prefix }}</span>
                  <input
                    :id="`social-${field.key}`"
                    v-model="profileForm.socialHandles[field.key]"
                    type="text"
                    :placeholder="field.placeholder"
                    class="min-w-0 flex-1 bg-white/50 px-3 py-3 text-sm text-g-text outline-none dark:bg-mica-navy-input dark:text-slate-200"
                  />
                </div>
                <input
                  v-else
                  :id="`social-${field.key}`"
                  v-model="profileForm.socialHandles[field.key]"
                  type="text"
                  :placeholder="field.placeholder"
                  class="field-input"
                />
              </div>
            </div>
          </div>

          <button type="submit" :disabled="savingProfile" class="btn-primary" data-cursor="cta">
            {{ savingProfile ? 'SAVING...' : 'SAVE PROFILE' }}
          </button>
        </form>
      </section>

      <!-- Owner: members -->
      <section v-if="isOwner" class="mica-card mb-6 rounded-3xl p-6 sm:p-8">
        <h3 class="mb-6 border-b border-g-border pb-4 font-mono text-lg font-semibold uppercase tracking-[0.1em] text-g-text">Members</h3>

        <div v-if="loadingMembers" class="h-20 animate-pulse rounded-xl bg-white/50 dark:bg-slate-800/40" />

        <div v-else class="mb-6 overflow-x-auto rounded-2xl border border-g-border">
          <table class="w-full min-w-[480px] border-collapse text-left font-mono text-xs">
            <thead>
              <tr class="border-b border-g-border bg-white/40 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-g-muted dark:bg-mica-navy-header">
                <th class="px-4 py-3">Email</th>
                <th class="px-4 py-3 text-center">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in members" :key="member.email" class="border-b border-g-border/70 last:border-0">
                <td class="px-4 py-3">{{ member.email }}</td>
                <td class="px-4 py-3 text-center">{{ member.activated_at ? 'Active' : 'Pending' }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    v-if="currentUser?.email !== member.email"
                    type="button"
                    class="font-bold uppercase tracking-wider text-red-500"
                    @click="removeMember(member.email)"
                  >
                    Remove
                  </button>
                  <span v-else class="text-g-muted">Owner</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <form class="mb-6 flex flex-col gap-2 sm:flex-row" @submit.prevent="sendInvite">
          <input v-model="inviteEmail" type="email" required placeholder="peer@apc.edu.ph" class="field-input min-w-0 flex-1" />
          <button type="submit" :disabled="sendingInvite" class="rounded-lg bg-g-primary px-4 py-3 font-mono text-xs font-bold uppercase text-white">
            {{ sendingInvite ? 'Inviting...' : 'Invite' }}
          </button>
        </form>

        <form class="flex flex-col gap-2 border-t border-g-border pt-6 sm:flex-row" @submit.prevent="showTransferModal = true">
          <input v-model="transferEmail" type="email" required placeholder="active-member@apc.edu.ph" class="field-input min-w-0 flex-1" />
          <button type="submit" class="rounded-lg bg-red-500 px-4 py-3 font-mono text-xs font-bold uppercase text-white">Transfer ownership</button>
        </form>
      </section>

      <!-- Member: leave -->
      <section v-else class="mica-card rounded-3xl p-6 sm:p-8">
        <h3 class="mb-2 font-mono text-sm font-bold uppercase tracking-[0.12em] text-g-text">Leave org</h3>
        <p class="mb-4 font-mono text-xs text-g-muted">You will lose access to org-scoped tools until re-invited.</p>
        <button
          type="button"
          :disabled="leaving"
          class="rounded-lg border border-red-500 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
          @click="leaveOrg"
        >
          {{ leaving ? 'Leaving...' : 'Leave org' }}
        </button>
      </section>
    </template>

    <!-- Transfer modal -->
    <div
      v-if="showTransferModal"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      @click.self="showTransferModal = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-6 shadow-2xl dark:bg-mica-navy-modal">
        <div class="mb-4 h-2 bg-red-500" />
        <p class="mb-6 font-mono text-xs text-g-muted">
          Transfer ownership to <strong class="text-g-text">{{ transferEmail }}</strong>? This is permanent.
        </p>
        <div class="flex justify-end gap-3">
          <button type="button" class="rounded-lg border border-g-border px-4 py-2 font-mono text-xs uppercase" @click="showTransferModal = false">Cancel</button>
          <button type="button" :disabled="transferring" class="rounded-lg bg-red-500 px-4 py-2 font-mono text-xs uppercase text-white" @click="executeTransfer">
            {{ transferring ? 'Transferring...' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { readImageAsDataUrl } from '@/composables/useImageUpload'
import OrgLogo from '@/components/OrgLogo.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import OrgLockout from '@/components/OrgLockout.vue'
import {
  EMPTY_SOCIAL_LINKS,
  orgInitials,
  type OrgListItem,
  type OrgProfileSettings,
  type OrgSocialLinks,
  type PublicOrgProfile,
} from '@/types/orgs'
import {
  SOCIAL_FIELD_META,
  socialHandlesToUrls,
  socialLinksToHandles,
} from '@/utils/orgSocialLinks'

interface OrgMember {
  email: string
  activated_at: string | null
}

interface ProfileFormState {
  isPublicCatalog: boolean
  tagline: string
  aboutMarkdown: string
  bannerUrl: string
  logoUrl: string
  socialHandles: Required<OrgSocialLinks>
}

const route = useRoute()
const router = useRouter()
const { authHeaders, getUser } = useAuth()
const toast = useToast()
const currentUser = getUser()

const slug = computed(() => route.params.slug as string)
const org = ref<OrgListItem | null>(null)
const profileForm = ref<ProfileFormState | null>(null)
const members = ref<OrgMember[]>([])
const userOrgs = ref<OrgListItem[]>([])

const loading = ref(true)
const error = ref('')
const loadingMembers = ref(false)
const savingProfile = ref(false)
const togglingCatalog = ref(false)
const uploadingBanner = ref(false)
const uploadingLogo = ref(false)
const sendingInvite = ref(false)
const leaving = ref(false)
const transferring = ref(false)
const showTransferModal = ref(false)

const inviteEmail = ref('')
const transferEmail = ref('')

const isLocked = computed(() => !loading.value && userOrgs.value.length === 0)
const isOwner = computed(() => org.value?.is_owner === 1)

function mapProfileToForm(profile: OrgProfileSettings): ProfileFormState {
  return {
    isPublicCatalog: profile.isPublicCatalog,
    tagline: profile.tagline ?? '',
    aboutMarkdown: profile.aboutMarkdown ?? '',
    bannerUrl: profile.bannerUrl ?? '',
    logoUrl: profile.logoUrl ?? '',
    socialHandles: socialLinksToHandles({ ...EMPTY_SOCIAL_LINKS, ...profile.socialLinks }),
  }
}

async function loadOrgContext() {
  loading.value = true
  error.value = ''
  org.value = null
  profileForm.value = null
  try {
    const listRes = await fetch(`${API_BASE_URL}/api/orgs`, { headers: authHeaders() })
    const listData = await listRes.json()
    if (!listRes.ok) throw new Error(listData.error || 'Failed to load org.')

    userOrgs.value = listData.orgs ?? []
    if (userOrgs.value.length === 0) return

    if (slug.value === '__none') {
      const savedId = localStorage.getItem('active_org_id')
      const fallback = userOrgs.value.find((o) => o.org_id === savedId) ?? userOrgs.value[0]
      router.replace({ name: 'orgs-modify', params: { slug: fallback.org_id } })
      return
    }

    const match = userOrgs.value.find((o) => o.org_id === slug.value)
    if (!match) {
      error.value = 'You do not have access to this org.'
      return
    }
    org.value = match
    localStorage.setItem('active_org_id', match.org_id)

    const profileRes = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/profile`, { headers: authHeaders() })
    const profileData = await profileRes.json()
    if (!profileRes.ok) throw new Error(profileData.error || 'Failed to load profile.')
    profileForm.value = mapProfileToForm(profileData.profile)

    if (match.is_owner === 1) await fetchMembers()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load org settings.'
  } finally {
    loading.value = false
  }
}

async function fetchMembers() {
  loadingMembers.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/members`, { headers: authHeaders() })
    const data = await res.json()
    if (res.ok) members.value = data.members ?? []
  } catch {
    toast.error('Failed to load members.')
  } finally {
    loadingMembers.value = false
  }
}

async function onBannerPicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !profileForm.value) return
  uploadingBanner.value = true
  try {
    profileForm.value.bannerUrl = await readImageAsDataUrl(file, 2 * 1024 * 1024)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Upload failed.')
  } finally {
    uploadingBanner.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function onLogoPicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !profileForm.value) return
  uploadingLogo.value = true
  try {
    profileForm.value.logoUrl = await readImageAsDataUrl(file, 1024 * 1024)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Upload failed.')
  } finally {
    uploadingLogo.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function togglePublicCatalog() {
  if (!profileForm.value) return
  togglingCatalog.value = true
  const next = !profileForm.value.isPublicCatalog
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/profile`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublicCatalog: next }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Update failed.')
    profileForm.value.isPublicCatalog = data.profile.isPublicCatalog
    toast.success(next ? 'Listed in /orgs directory.' : 'Removed from directory.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  } finally {
    togglingCatalog.value = false
  }
}

function openPreview() {
  if (!org.value || !profileForm.value) return
  const draft: PublicOrgProfile = {
    slug: org.value.org_id,
    name: org.value.org_name,
    tagline: profileForm.value.tagline.trim() || null,
    aboutMarkdown: profileForm.value.aboutMarkdown.trim() || null,
    bannerUrl: profileForm.value.bannerUrl || null,
    logoUrl: profileForm.value.logoUrl || null,
    socialLinks: socialHandlesToUrls(profileForm.value.socialHandles),
  }
  sessionStorage.setItem(`eypi_org_preview_${org.value.org_id}`, JSON.stringify(draft))
  window.open(`/orgs/${org.value.org_id}?preview=1`, '_blank', 'noopener,noreferrer')
}

async function saveProfile() {
  if (!profileForm.value) return
  savingProfile.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/profile`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagline: profileForm.value.tagline.trim() || null,
        aboutMarkdown: profileForm.value.aboutMarkdown.trim() || null,
        bannerUrl: profileForm.value.bannerUrl || null,
        logoUrl: profileForm.value.logoUrl || null,
        socialLinks: socialHandlesToUrls(profileForm.value.socialHandles),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Save failed.')
    profileForm.value = mapProfileToForm(data.profile)
    toast.success('Profile saved.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Save failed.')
  } finally {
    savingProfile.value = false
  }
}

async function sendInvite() {
  sendingInvite.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/members`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.value.toLowerCase().trim() }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Invite failed.')
    toast.success('Invitation sent.')
    inviteEmail.value = ''
    await fetchMembers()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Invite failed.')
  } finally {
    sendingInvite.value = false
  }
}

async function removeMember(email: string) {
  if (!confirm(`Remove ${email}?`)) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/members`, {
      method: 'DELETE',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Remove failed.')
    await fetchMembers()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Remove failed.')
  }
}

async function executeTransfer() {
  transferring.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/transfer`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: transferEmail.value.toLowerCase().trim() }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Transfer failed.')
    toast.success('Ownership transferred.')
    showTransferModal.value = false
    router.push('/orgs/modify')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Transfer failed.')
  } finally {
    transferring.value = false
  }
}

async function leaveOrg() {
  if (!confirm('Leave this org?')) return
  leaving.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${slug.value}/leave`, {
      method: 'POST',
      headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not leave org.')
    toast.success('You left the org.')
    router.push('/orgs/modify')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not leave org.')
  } finally {
    leaving.value = false
  }
}

onMounted(loadOrgContext)
watch(slug, loadOrgContext)
</script>

<style scoped>
.field-input {
  @apply rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500;
}
.btn-primary {
  @apply rounded-xl bg-g-accent px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50;
}
</style>

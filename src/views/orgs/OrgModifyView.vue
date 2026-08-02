<template>
  <section class="relative mx-auto flex w-full max-w-5xl flex-col px-6 py-16">
    <div class="mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="font-display text-3xl font-bold text-g-text">
          Org settings
        </h1>
      </div>
      <div v-if="!isLocked" class="flex flex-wrap items-center gap-3">
        <OrgSwitcher />
      </div>
    </div>

    <div v-if="isLocked">
      <OrgLockout />
    </div>

    <div v-else-if="loading" class="space-y-4">
      <div class="h-10 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
      <div class="h-64 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <div v-else-if="error" class="rounded-2xl border border-g-border bg-g-surface p-8 text-center text-sm text-g-destructive">
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
            <h2 class="text-section-title break-words">{{ org.org_name }}</h2>
          </div>
        </div>
        <span
          class="inline-flex w-fit rounded-full border px-3 py-1 text-sm font-medium"
          :class="isOwner ? 'border-g-accent/40 bg-g-accent/10 text-g-accent' : 'border-g-border text-g-muted'"
        >
          {{ isOwner ? 'Owner' : 'Member' }}
        </span>
      </header>

      <!-- Public directory profile -->
      <section class="mb-6 rounded-2xl border border-g-border bg-g-surface p-6 sm:p-8">
        <div class="mb-6 flex flex-col gap-3 border-b border-g-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 class="text-section-title">Public profile</h3>
            <p class="mt-1 text-sm text-g-muted">Shown on /orgs when listed in the directory.</p>
          </div>
          <button
            type="button"
            :class="buttonVariants({ variant: 'secondary', size: 'sm' })"
            @click="openPreview"
          >
            Preview ↗
          </button>
        </div>

        <div class="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-g-border bg-g-bg p-4">
          <div>
            <p class="text-sm font-medium text-g-text">List in /orgs directory</p>
          </div>
          <Switch
            :model-value="profileForm.isPublicCatalog"
            :disabled="togglingCatalog"
            :aria-label="profileForm.isPublicCatalog ? 'Remove from directory' : 'List in directory'"
            @update:model-value="togglePublicCatalog"
          />
        </div>

        <form class="space-y-5" @submit.prevent="saveProfile">
          <div class="flex flex-col gap-2">
            <label for="tagline" class="text-sm font-medium text-g-muted">Tagline</label>
            <input id="tagline" v-model="profileForm.tagline" type="text" maxlength="160" class="field-input" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="org-type" class="text-sm font-medium text-g-muted">Org type</label>
            <select id="org-type" v-model="profileForm.orgType" class="field-input">
              <option value="">Not set</option>
              <option v-for="option in ORG_TYPE_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label for="about" class="text-sm font-medium text-g-muted">About (Markdown)</label>
            <textarea id="about" v-model="profileForm.aboutMarkdown" rows="6" maxlength="8000" class="field-input" />
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div class="flex flex-col gap-3">
              <span class="text-sm font-medium text-g-muted">Banner</span>
              <div
                class="relative h-28 overflow-hidden rounded-xl border border-g-border"
                :class="profileForm.bannerUrl ? '' : 'bg-gradient-to-br from-g-brand to-g-primary'"
              >
                <img v-if="profileForm.bannerUrl" :src="profileForm.bannerUrl" alt="Banner preview" class="h-full w-full object-cover" />
              </div>
              <label class="cursor-pointer rounded-lg border-2 border-dashed border-g-border px-4 py-3 text-center text-sm font-medium text-g-muted transition-colors hover:border-g-accent hover:text-g-accent">
                {{ uploadingBanner ? 'Uploading...' : 'Upload banner' }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="uploadingBanner" @change="onBannerPicked" />
              </label>
              <button
                v-if="profileForm.bannerUrl"
                type="button"
                class="text-left text-sm font-medium text-red-500"
                @click="profileForm.bannerUrl = ''"
              >
                Remove banner
              </button>
            </div>

            <div class="flex flex-col gap-3">
              <span class="text-sm font-medium text-g-muted">Logo</span>
              <div class="flex h-28 items-center justify-center">
                <div
                  v-if="profileForm.logoUrl"
                  class="h-24 w-24 overflow-hidden rounded-2xl border border-g-border"
                >
                  <img :src="profileForm.logoUrl" alt="Logo preview" class="h-full w-full object-cover" />
                </div>
                <div
                  v-else
                  class="flex h-24 w-24 items-center justify-center rounded-2xl border border-g-border bg-g-brand/10 text-lg font-bold text-g-brand"
                >
                  {{ orgInitials(org.org_name) }}
                </div>
              </div>
              <label class="cursor-pointer rounded-lg border-2 border-dashed border-g-border px-4 py-3 text-center text-sm font-medium text-g-muted transition-colors hover:border-g-accent hover:text-g-accent">
                {{ uploadingLogo ? 'Uploading...' : 'Upload logo' }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="uploadingLogo" @change="onLogoPicked" />
              </label>
              <button
                v-if="profileForm.logoUrl"
                type="button"
                class="text-left text-sm font-medium text-red-500"
                @click="profileForm.logoUrl = ''"
              >
                Remove logo
              </button>
            </div>
          </div>

          <div>
            <p class="mb-3 text-sm font-medium text-g-muted">Social links</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="field in SOCIAL_FIELD_META" :key="field.key" class="flex flex-col gap-2">
                <label :for="`social-${field.key}`" class="text-sm font-medium text-g-muted">{{ field.label }}</label>
                <div v-if="field.prefix" class="flex overflow-hidden rounded-xl border border-g-border focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
                  <span class="text-data flex shrink-0 items-center bg-g-bg px-3 text-xs text-g-muted">{{ field.prefix }}</span>
                  <input
                    :id="`social-${field.key}`"
                    v-model="profileForm.socialHandles[field.key]"
                    type="text"
                    :placeholder="field.placeholder"
                    class="min-w-0 flex-1 bg-g-surface px-3 py-3 text-sm text-g-text outline-none"
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

          <Button type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving...' : 'Save profile' }}
          </Button>
        </form>
      </section>

      <!-- Owner: members -->
      <section v-if="isOwner" class="mb-6 rounded-2xl border border-g-border bg-g-surface p-6 sm:p-8">
        <h3 class="text-section-title mb-6 border-b border-g-border pb-4">Members</h3>

        <div v-if="loadingMembers" class="h-20 animate-pulse rounded-xl bg-g-bg" />

        <div v-else class="mb-6 overflow-x-auto rounded-2xl border border-g-border">
          <table class="text-data w-full min-w-[480px] border-collapse text-left text-xs">
            <thead>
              <tr class="border-b border-g-border bg-g-bg text-xs font-semibold text-g-muted">
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
                    class="font-semibold text-g-destructive"
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
          <Button type="submit" :disabled="sendingInvite" className="shrink-0">
            {{ sendingInvite ? 'Inviting...' : 'Invite' }}
          </Button>
        </form>

        <form class="flex flex-col gap-2 border-t border-g-border pt-6 sm:flex-row" @submit.prevent="confirmTransfer">
          <input v-model="transferEmail" type="email" required placeholder="active-member@apc.edu.ph" class="field-input min-w-0 flex-1" />
          <Button type="submit" variant="destructive" :disabled="transferring" className="shrink-0">
            {{ transferring ? 'Transferring...' : 'Transfer ownership' }}
          </Button>
        </form>
      </section>

      <!-- Member: leave -->
      <section v-else class="rounded-2xl border border-g-border bg-g-surface p-6 sm:p-8">
        <h3 class="font-display text-lg font-semibold text-g-text mb-2">Leave org</h3>
        <p class="mb-4 text-sm text-g-muted">You will lose access to org-scoped tools until re-invited.</p>
        <Button
          type="button"
          variant="destructive"
          :disabled="leaving"
          @click="leaveOrg"
        >
          {{ leaving ? 'Leaving...' : 'Leave org' }}
        </Button>
      </section>
    </template>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { readImageAsDataUrl } from '@/composables/useImageUpload'
import OrgLogo from '@/components/OrgLogo.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import OrgLockout from '@/components/OrgLockout.vue'
import Switch from '@/components/ui/Switch.vue'
import Button from '@/components/ui/Button.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'
import {
  EMPTY_SOCIAL_LINKS,
  orgInitials,
  type OrgListItem,
  type OrgProfileSettings,
  type OrgSocialLinks,
  type PublicOrgProfile,
} from '@/types/orgs'
import { ORG_TYPE_OPTIONS, type OrgType } from '@/constants/orgTypes'
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
  orgType: OrgType | ''
  aboutMarkdown: string
  bannerUrl: string
  logoUrl: string
  socialHandles: Required<OrgSocialLinks>
}

const route = useRoute()
const router = useRouter()
const { authHeaders, getUser } = useAuth()
const { setActiveOrg } = useActiveOrg()
const toast = useToast()
const dialog = useDialog()
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

const inviteEmail = ref('')
const transferEmail = ref('')

const isLocked = computed(() => !loading.value && userOrgs.value.length === 0)
const isOwner = computed(() => org.value?.is_owner === 1)

function mapProfileToForm(profile: OrgProfileSettings): ProfileFormState {
  return {
    isPublicCatalog: profile.isPublicCatalog,
    tagline: profile.tagline ?? '',
    orgType: profile.orgType ?? '',
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
    setActiveOrg(match)

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
    orgType: profileForm.value.orgType || null,
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
        orgType: profileForm.value.orgType || null,
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
  const ok = await dialog.confirm({
    title: 'Remove this member?',
    body: `Removes ${email} from this org. They will lose access until invited again.`,
    confirmLabel: 'Remove member',
  })
  if (!ok) return
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

async function confirmTransfer() {
  const targetEmail = transferEmail.value.toLowerCase().trim()
  const orgName = org.value?.org_name ?? slug.value
  const ok = await dialog.confirm({
    title: 'Transfer ownership?',
    body: `Transfers "${orgName}" to ${targetEmail}. You will no longer be the owner.`,
    confirmLabel: 'Transfer ownership',
    requireText: orgName,
  })
  if (!ok) return
  await executeTransfer()
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
    router.push('/orgs/modify')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Transfer failed.')
  } finally {
    transferring.value = false
  }
}

async function leaveOrg() {
  const orgName = org.value?.org_name ?? slug.value
  const ok = await dialog.confirm({
    title: 'Leave this org?',
    body: `Leaves "${orgName}". You will lose access until invited again.`,
    confirmLabel: 'Leave org',
    requireText: orgName,
  })
  if (!ok) return
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
  @apply h-11 w-full rounded-xl border border-g-border bg-g-surface px-4 text-base text-g-text outline-none placeholder:text-g-muted focus-visible:ring-2 focus-visible:ring-[var(--color-ring)];
}
</style>

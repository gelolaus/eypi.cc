<template>
  <AppPage title="Org settings">
    <div v-if="isLocked">
      <OrgLockout />
    </div>

    <DetailSkeleton
      v-else-if="loading"
      :title-height="40"
      :body-height="256"
    />

    <div
      v-else-if="error"
      role="alert"
      class="rounded-3xl border border-destructive/30 bg-destructive/10 p-8 text-center text-sm text-destructive"
    >
      {{ error }}
    </div>

    <template v-else-if="org && profileForm">
      <header class="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex min-w-0 items-start gap-4">
          <OrgLogo
            :logo-url="profileForm.logoUrl"
            :logo-meta="profileForm.logoMeta"
            :name="org.org_name"
            size="md"
          />
          <div class="min-w-0">
            <h2 class="break-words font-heading text-xl font-semibold tracking-tight">
              {{ org.org_name }}
            </h2>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            as-child
            variant="outline"
          >
            <router-link :to="`/orgs/${encodeURIComponent(org.org_id)}/insights`">
              View insights
            </router-link>
          </Button>
          <Badge
            :variant="isOwner ? 'default' : 'outline'"
            class="h-7 px-3 text-sm"
          >
            {{ isOwner ? 'Owner' : 'Member' }}
          </Badge>
        </div>
      </header>

      <!-- Public directory profile -->
      <AppSection>
        <div class="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 class="font-heading text-xl font-semibold tracking-tight">
              Public profile
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
              Shown on /orgs when listed in the directory.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            class="shrink-0 gap-1 text-sm"
            @click="openPreview"
          >
            Preview ↗
          </Button>
        </div>

        <div class="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/40 p-4">
          <div>
            <p class="text-sm font-medium">
              List in /orgs directory
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="profileForm.isPublicCatalog"
            :aria-label="profileForm.isPublicCatalog ? 'Remove from directory' : 'List in directory'"
            :disabled="togglingCatalog"
            class="group relative flex h-11 w-14 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            @click="togglePublicCatalog"
          >
            <span
              class="relative block h-7 w-12 rounded-full transition-colors"
              :class="profileForm.isPublicCatalog ? 'bg-primary' : 'bg-input'"
            >
              <span
                class="pointer-events-none absolute left-0.5 top-0.5 block size-6 rounded-full bg-background shadow transition-transform"
                :class="profileForm.isPublicCatalog ? 'translate-x-5' : 'translate-x-0'"
              />
            </span>
          </button>
        </div>

        <form
          class="space-y-5"
          @submit.prevent="saveProfile"
        >
          <div class="flex flex-col gap-2">
            <Label for="tagline">Tagline</Label>
            <Input
              id="tagline"
              v-model="profileForm.tagline"
              type="text"
              maxlength="160"
            />
          </div>

          <div class="flex flex-col gap-2">
            <Label for="org-type">Org type</Label>
            <select
              id="org-type"
              v-model="profileForm.orgType"
              :class="selectClass"
            >
              <option value="">
                Not set
              </option>
              <option
                v-for="option in ORG_TYPE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="about">About (Markdown)</Label>
            <Textarea
              id="about"
              v-model="profileForm.aboutMarkdown"
              rows="6"
              maxlength="8000"
              class="rounded-xl px-3.5"
            />
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div class="flex flex-col gap-3">
              <span class="text-base font-medium">Banner</span>
              <div
                class="relative h-28 overflow-hidden rounded-xl border border-border"
                :class="profileForm.bannerUrl ? '' : 'bg-gradient-to-br from-primary/40 to-muted'"
              >
                <AppImage
                  v-if="profileForm.bannerUrl"
                  :src="profileForm.bannerUrl"
                  :meta="profileForm.bannerMeta"
                  sizes="(min-width: 768px) 50vw, 100vw"
                  alt="Banner preview"
                  class="h-full w-full object-cover"
                />
              </div>
              <label class="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                {{ uploadingBanner ? 'Uploading...' : 'Upload banner' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  :disabled="uploadingBanner"
                  @change="onBannerPicked"
                >
              </label>
              <Button
                v-if="profileForm.bannerUrl"
                type="button"
                variant="destructive"
                class="w-fit text-sm"
                :disabled="uploadingBanner"
                @click="clearOrgImage('bannerUrl')"
              >
                Remove banner
              </Button>
            </div>

            <div class="flex flex-col gap-3">
              <span class="text-base font-medium">Logo</span>
              <div class="flex h-28 items-center justify-center">
                <div
                  v-if="profileForm.logoUrl"
                  class="size-24 overflow-hidden rounded-2xl border border-border"
                >
                  <AppImage
                    :src="profileForm.logoUrl"
                    :meta="profileForm.logoMeta"
                    sizes="96px"
                    alt="Logo preview"
                    class="h-full w-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="flex size-24 items-center justify-center rounded-2xl border border-border bg-primary/10 text-lg font-bold text-primary"
                >
                  {{ orgInitials(org.org_name) }}
                </div>
              </div>
              <label class="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                {{ uploadingLogo ? 'Uploading...' : 'Upload logo' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  :disabled="uploadingLogo"
                  @change="onLogoPicked"
                >
              </label>
              <Button
                v-if="profileForm.logoUrl"
                type="button"
                variant="destructive"
                class="w-fit text-sm"
                :disabled="uploadingLogo"
                @click="clearOrgImage('logoUrl')"
              >
                Remove logo
              </Button>
            </div>
          </div>

          <div>
            <p class="mb-3 text-base font-medium">
              Social links
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <div
                v-for="field in SOCIAL_FIELD_META"
                :key="field.key"
                class="flex flex-col gap-2"
              >
                <Label :for="`social-${field.key}`">{{ field.label }}</Label>
                <div
                  v-if="field.prefix"
                  class="flex h-11 overflow-hidden rounded-xl border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
                >
                  <span class="flex shrink-0 items-center bg-muted px-3 font-mono text-xs text-muted-foreground">{{ field.prefix }}</span>
                  <input
                    :id="`social-${field.key}`"
                    v-model="profileForm.socialHandles[field.key]"
                    type="text"
                    :placeholder="field.placeholder"
                    class="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground"
                  >
                </div>
                <Input
                  v-else
                  :id="`social-${field.key}`"
                  v-model="profileForm.socialHandles[field.key]"
                  type="text"
                  :placeholder="field.placeholder"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            :disabled="savingProfile || uploadingLogo || uploadingBanner"
            class="w-full px-6 sm:w-auto"
          >
            {{ savingProfile ? 'Saving...' : 'Save profile' }}
          </Button>
        </form>
      </AppSection>

      <!-- Owner: members -->
      <AppSection v-if="isOwner">
        <h3 class="mb-6 border-b border-border pb-4 font-heading text-xl font-semibold tracking-tight">
          Members
        </h3>

        <ListSkeleton
          v-if="loadingMembers"
          class="mb-6"
          :rows="1"
          :row-height="80"
          label="Loading members"
        />
        <p
          v-else-if="membersError"
          role="alert"
          class="mb-6 text-sm text-destructive"
        >
          {{ membersError }}
        </p>
        <p
          v-else-if="members.length === 0"
          class="mb-6 text-sm text-muted-foreground"
        >
          No members yet.
        </p>
        <div
          v-else
          class="mb-6 overflow-x-auto md:rounded-2xl md:border md:border-border"
        >
          <!-- Explicit table roles are kept on purpose: Safari drops table semantics once display is overridden by utilities. -->
          <!-- eslint-disable vuejs-accessibility/no-redundant-roles -->
          <table
            role="table"
            aria-label="Members"
            class="block w-full border-collapse text-left font-mono text-sm md:table md:text-xs"
          >
            <thead
              role="rowgroup"
              class="sr-only md:not-sr-only md:table-header-group"
            >
              <tr
                role="row"
                class="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground"
              >
                <th
                  role="columnheader"
                  class="px-4 py-3"
                >
                  Name
                </th>
                <th
                  role="columnheader"
                  class="px-4 py-3"
                >
                  Email
                </th>
                <th
                  role="columnheader"
                  class="px-4 py-3 text-center"
                >
                  Status
                </th>
                <th
                  role="columnheader"
                  class="px-4 py-3 text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody
              role="rowgroup"
              class="block space-y-3 md:table-row-group md:space-y-0"
            >
              <tr
                v-for="member in members"
                :key="member.email"
                role="row"
                class="block rounded-2xl border border-border bg-card p-4 md:table-row md:rounded-none md:border-0 md:border-b md:border-border/70 md:bg-transparent md:p-0 md:last:border-0"
              >
                <td
                  role="cell"
                  class="block break-words font-semibold md:table-cell md:px-4 md:py-3 md:font-normal"
                >
                  {{ member.name?.trim() || 'No account yet' }}
                </td>
                <td
                  role="cell"
                  class="block break-all text-muted-foreground md:table-cell md:px-4 md:py-3 md:text-inherit"
                >
                  {{ member.email }}
                </td>
                <td
                  role="cell"
                  class="mt-1 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-center"
                >
                  {{ memberStatus(member) }}
                </td>
                <td
                  role="cell"
                  class="mt-2 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-right"
                >
                  <div
                    v-if="isPendingMember(member)"
                    class="flex flex-wrap gap-2 md:justify-end"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      class="px-4 text-sm"
                      :disabled="resendingEmail === member.email"
                      @click="resendInvite(member.email)"
                    >
                      {{ resendingEmail === member.email ? 'Resending...' : 'Resend' }}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      class="px-4 text-sm"
                      @click="cancelInvite(member.email)"
                    >
                      Cancel invite
                    </Button>
                  </div>
                  <Button
                    v-else-if="member.activated_at && !isOwnerMember(member)"
                    type="button"
                    variant="destructive"
                    class="px-4 text-sm"
                    @click="removeMember(member.email)"
                  >
                    Remove
                  </Button>
                  <span
                    v-else-if="member.activated_at"
                    class="text-muted-foreground"
                  >Owner</span>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- eslint-enable vuejs-accessibility/no-redundant-roles -->
        </div>
        <p
          v-if="membersActionError"
          role="alert"
          class="mb-6 text-sm text-destructive"
        >
          {{ membersActionError }}
        </p>

        <div class="mb-6">
          <form
            class="flex flex-col gap-2"
            @submit.prevent="sendInvite"
          >
            <Label for="invite-email">Invite email</Label>
            <div class="flex flex-col gap-2 sm:flex-row">
              <Input
                id="invite-email"
                v-model="inviteEmail"
                type="email"
                required
                placeholder="peer@apc.edu.ph"
                :aria-invalid="Boolean(inviteError)"
                :aria-describedby="inviteError ? 'invite-error' : undefined"
                class="min-w-0 flex-1"
              />
              <Button
                type="submit"
                :disabled="sendingInvite"
                class="shrink-0 px-6"
              >
                {{ sendingInvite ? 'Inviting...' : 'Invite' }}
              </Button>
            </div>
          </form>
          <p
            v-if="inviteError"
            id="invite-error"
            role="alert"
            class="mt-2 text-sm text-destructive"
          >
            {{ inviteError }}
          </p>
        </div>

        <form
          class="flex flex-col gap-3 border-t border-border pt-6"
          @submit.prevent="confirmTransfer"
        >
          <div class="flex flex-col gap-2">
            <Label for="new-owner">New owner</Label>
            <select
              id="new-owner"
              v-model="transferEmail"
              required
              :disabled="activeMembers.length === 0"
              :class="selectClass"
            >
              <option
                value=""
                disabled
              >
                Select a member
              </option>
              <option
                v-for="member in activeMembers"
                :key="member.email"
                :value="member.email"
              >
                {{ memberLabel(member) }}
              </option>
            </select>
          </div>
          <p
            v-if="!loadingMembers && !membersError && activeMembers.length === 0"
            class="text-sm text-muted-foreground"
          >
            Invite an active member before transferring ownership.
          </p>
          <Button
            type="submit"
            variant="destructive"
            :disabled="transferring || activeMembers.length === 0"
            class="w-full sm:w-fit"
          >
            {{ transferring ? 'Transferring...' : 'Transfer ownership' }}
          </Button>
        </form>
      </AppSection>

      <!-- Member: leave -->
      <AppSection v-else>
        <h3 class="mb-2 font-heading text-lg font-semibold">
          Leave org
        </h3>
        <p class="mb-4 text-sm text-muted-foreground">
          You will lose access to org-scoped tools until re-invited.
        </p>
        <Button
          type="button"
          variant="destructive"
          :disabled="leaving"
          class="w-full sm:w-fit"
          @click="leaveOrg"
        >
          {{ leaving ? 'Leaving...' : 'Leave org' }}
        </Button>
      </AppSection>
    </template>
  </AppPage>
</template>

<script setup lang="ts">
import ListSkeleton from '@/components/skeletons/ListSkeleton.vue'
import DetailSkeleton from '@/components/skeletons/DetailSkeleton.vue'
import AppImage from '@/components/AppImage.vue'
import { uploadVariants } from '@/lib/images/uploadVariants'
import type { ImageMeta } from '@/lib/images/variants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useToast } from '@/composables/useToast'
import { runWithUndo } from '@/composables/useUndoToast'
import { useDialog } from '@/composables/useDialog'
import { readImageAsDataUrl } from '@/composables/useImageUpload'
import OrgLogo from '@/components/OrgLogo.vue'
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import OrgLockout from '@/components/OrgLockout.vue'
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
  user_id?: string | null
  activated_at: string | null
  declined_at?: string | null
  name?: string | null
}

interface ProfileFormState {
  isPublicCatalog: boolean
  tagline: string
  orgType: OrgType | ''
  aboutMarkdown: string
  bannerUrl: string
  logoUrl: string
  bannerMeta: ImageMeta | null
  logoMeta: ImageMeta | null
  socialHandles: Required<OrgSocialLinks>
}

const selectClass ='h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-popover [&>option]:text-popover-foreground'

const route = useRoute()
const router = useRouter()
const session = useSession()
const { setActiveOrg, fetchOrgs } = useActiveOrg()
const toast = useToast()
const dialog = useDialog()
const currentUser = computed(() => session.user.value)

const slug = computed(() => route.params.slug as string)
const org = ref<OrgListItem | null>(null)
const profileForm = ref<ProfileFormState | null>(null)
const members = ref<OrgMember[]>([])
const userOrgs = ref<OrgListItem[]>([])

const loading = ref(true)
const error = ref('')
const loadingMembers = ref(false)
const membersError = ref('')
const membersActionError = ref('')
const inviteError = ref('')
const savingProfile = ref(false)
const togglingCatalog = ref(false)
const uploadingBanner = ref(false)
const uploadingLogo = ref(false)
const sendingInvite = ref(false)
const leaving = ref(false)
const transferring = ref(false)

const inviteEmail = ref('')
const transferEmail = ref('')
const resendingEmail = ref('')

const isLocked = computed(() => !loading.value && userOrgs.value.length === 0)
const isOwner = computed(() => org.value?.is_owner === 1)
const activeMembers = computed(() => members.value.filter((member) => member.activated_at && !isOwnerMember(member)))

function isPendingMember(member: OrgMember): boolean {
  return !member.activated_at && !member.declined_at
}

function memberStatus(member: OrgMember): string {
  if (member.activated_at) return 'Active'
  if (member.declined_at) return 'Declined'
  return 'Pending'
}

function isOwnerMember(member: OrgMember): boolean {
  if (org.value?.owner_id && member.user_id && member.user_id === org.value.owner_id) return true
  const mine = currentUser.value?.email
  return !!mine && mine.toLowerCase() === member.email.toLowerCase()
}

function memberLabel(member: OrgMember): string {
  const name = member.name?.trim()
  return name ? `${name} (${member.email})` : member.email
}

function messageFrom(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const error = (data as { error?: unknown }).error
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function mapProfileToForm(profile: OrgProfileSettings): ProfileFormState {
  return {
    isPublicCatalog: profile.isPublicCatalog,
    tagline: profile.tagline ?? '',
    orgType: profile.orgType ?? '',
    aboutMarkdown: profile.aboutMarkdown ?? '',
    bannerUrl: profile.bannerUrl ?? '',
    logoUrl: profile.logoUrl ?? '',
    bannerMeta: profile.bannerMeta ?? null,
    logoMeta: profile.logoMeta ?? null,
    socialHandles: socialLinksToHandles({ ...EMPTY_SOCIAL_LINKS, ...profile.socialLinks }),
  }
}

async function loadOrgContext() {
  loading.value = true
  error.value = ''
  org.value = null
  profileForm.value = null
  try {
    const listRes = await api.raw(`/api/orgs`)
    const listData = await listRes.json() as { error?: string; orgs?: OrgListItem[] }
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

    const profileRes = await api.raw(`/api/orgs/${slug.value}/profile`)
    const profileData = await profileRes.json() as { error?: string; profile: OrgProfileSettings }
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
  membersError.value = ''
  try {
    const res = await api.raw(`/api/orgs/${slug.value}/members`)
    const data = await res.json() as { members?: OrgMember[] }
    if (!res.ok) {
      members.value = []
      membersError.value = messageFrom(data, 'Could not load members. Try again.')
      return
    }
    members.value = data.members ?? []
  } catch {
    members.value = []
    membersError.value = 'Could not load members. Try again.'
  } finally {
    loadingMembers.value = false
  }
}

const ORG_IMAGE_MAX_BYTES = 10 * 1024 * 1024

async function storeOrgImage(
  field: 'bannerUrl' | 'logoUrl',
  value: string | null,
  fallback: string,
  variantsFrom?: File,
) {
  if (!profileForm.value) return
  const metaField = field === 'bannerUrl' ? 'bannerMeta' : 'logoMeta'
  const res = await api.raw(`/api/orgs/${slug.value}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value }),
  })
  const data = await res.json() as { profile?: OrgProfileSettings }
  if (!res.ok || !data.profile) throw new Error(messageFrom(data, fallback))
  profileForm.value[field] = data.profile[field] ?? ''
  profileForm.value[metaField] = data.profile[metaField] ?? null
  // Variants are best-effort: the image is already saved, so a failure here changes nothing.
  if (variantsFrom && data.profile[field]) {
    const meta = await uploadVariants(variantsFrom, field === 'bannerUrl' ? 'banner' : 'orgLogo', data.profile[field])
    if (meta && profileForm.value[field] === data.profile[field]) profileForm.value[metaField] = meta
  }
}

async function onBannerPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !profileForm.value) return
  uploadingBanner.value = true
  try {
    const dataUrl = await readImageAsDataUrl(file, ORG_IMAGE_MAX_BYTES)
    await storeOrgImage('bannerUrl', dataUrl, 'Upload failed.', file)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Upload failed.')
  } finally {
    uploadingBanner.value = false
    input.value = ''
  }
}

async function onLogoPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !profileForm.value) return
  uploadingLogo.value = true
  try {
    const dataUrl = await readImageAsDataUrl(file, ORG_IMAGE_MAX_BYTES)
    await storeOrgImage('logoUrl', dataUrl, 'Upload failed.', file)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Upload failed.')
  } finally {
    uploadingLogo.value = false
    input.value = ''
  }
}

async function clearOrgImage(field: 'bannerUrl' | 'logoUrl') {
  if (!profileForm.value) return
  const uploading = field === 'bannerUrl' ? uploadingBanner : uploadingLogo
  uploading.value = true
  try {
    await storeOrgImage(field, null, 'Could not remove that image.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not remove that image.')
  } finally {
    uploading.value = false
  }
}

async function togglePublicCatalog() {
  if (!profileForm.value) return
  togglingCatalog.value = true
  const next = !profileForm.value.isPublicCatalog
  try {
    const res = await api.raw(`/api/orgs/${slug.value}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublicCatalog: next }),
    })
    const data = await res.json() as { error?: string; profile: OrgProfileSettings }
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
  if (!profileForm.value || uploadingLogo.value || uploadingBanner.value) return
  savingProfile.value = true
  try {
    const res = await api.raw(`/api/orgs/${slug.value}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagline: profileForm.value.tagline.trim() || null,
        orgType: profileForm.value.orgType || null,
        aboutMarkdown: profileForm.value.aboutMarkdown.trim() || null,
        bannerUrl: profileForm.value.bannerUrl || null,
        logoUrl: profileForm.value.logoUrl || null,
        socialLinks: socialHandlesToUrls(profileForm.value.socialHandles),
      }),
    })
    const data = await res.json() as { error?: string; profile: OrgProfileSettings }
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
  inviteError.value = ''
  try {
    const res = await api.raw(`/api/orgs/${slug.value}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.value.toLowerCase().trim() }),
    })
    const data = await res.json() as unknown
    if (!res.ok) {
      inviteError.value = messageFrom(data, 'Could not send invite.')
      return
    }
    toast.success('Invitation sent.')
    inviteEmail.value = ''
    await fetchMembers()
  } catch {
    inviteError.value = 'Could not send invite.'
  } finally {
    sendingInvite.value = false
  }
}

// Both are reversible: a removed member can be re-invited. The request waits out the undo window.
function removeWithUndo(email: string, message: string, fallback: string) {
  const before = members.value
  membersActionError.value = ''
  runWithUndo({
    message,
    apply: () => { members.value = before.filter((member) => member.email !== email) },
    revert: () => { members.value = before },
    commit: async () => {
      const res = await api.raw(`/api/orgs/${slug.value}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        keepalive: true,
      })
      if (!res.ok) throw new Error(fallback)
      await fetchMembers()
    },
  })
}

function removeMember(email: string) {
  removeWithUndo(email, 'Member removed.', 'Could not remove member.')
}

function cancelInvite(email: string) {
  removeWithUndo(email, 'Invite cancelled.', 'Could not cancel invite.')
}

async function resendInvite(email: string) {
  resendingEmail.value = email
  membersActionError.value = ''
  try {
    const res = await api.raw(`/api/orgs/${slug.value}/members/${encodeURIComponent(email)}/resend`, {
      method: 'POST',
    })
    const data = await res.json() as unknown
    if (!res.ok) {
      membersActionError.value = messageFrom(data, 'Could not resend invite.')
      return
    }
    toast.success('Invite resent.')
    await fetchMembers()
  } catch {
    membersActionError.value = 'Could not resend invite.'
  } finally {
    resendingEmail.value = ''
  }
}

async function confirmTransfer() {
  const targetEmail = transferEmail.value.toLowerCase().trim()
  if (!targetEmail) return
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
    const res = await api.raw(`/api/orgs/${slug.value}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: transferEmail.value.toLowerCase().trim() }),
    })
    const data = await res.json() as { error?: string }
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
    const res = await api.raw(`/api/orgs/${slug.value}/leave`, {
      method: 'POST',
      })
    const data = await res.json() as { error?: string }
    if (!res.ok) throw new Error(data.error || 'Could not leave org.')
    localStorage.removeItem('active_org_id')
    useOrgMembership().clearOrgMembershipCache()
    await fetchOrgs()
    toast.success('You left the org.')
    await router.push('/orgs/modify')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not leave org.')
  } finally {
    leaving.value = false
  }
}

onMounted(loadOrgContext)
watch(slug, loadOrgContext)
</script>


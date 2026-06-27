<template>
  <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-8 sm:px-6 md:pt-16 md:pb-32 lg:px-8">
    <header class="mb-10 flex flex-col gap-5 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-g-muted">
          organization console
        </p>
        <h1 class="font-mono text-3xl font-semibold tracking-tight text-g-text sm:text-4xl">
          Organizations.
        </h1>
        <p class="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-g-muted">
          Manage the organizations you own separately from the organizations where you are a member.
        </p>
      </div>

      <router-link
        to="/dashboard"
        class="inline-flex items-center justify-center rounded-full border border-g-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-g-muted transition-all hover:-translate-y-0.5 hover:border-g-accent hover:text-g-text"
        data-cursor="nav"
      >
        Dashboard
      </router-link>
    </header>

    <section class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="mica-card rounded-2xl p-5">
        <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-g-muted">Owned</p>
        <p class="mt-3 font-mono text-3xl font-semibold text-g-text">{{ ownedOrgs.length }}</p>
      </div>
      <div class="mica-card rounded-2xl p-5">
        <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-g-muted">Member</p>
        <p class="mt-3 font-mono text-3xl font-semibold text-g-text">{{ memberOrgs.length }}</p>
      </div>
      <div class="mica-card rounded-2xl p-5">
        <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-g-muted">Total</p>
        <p class="mt-3 font-mono text-3xl font-semibold text-g-text">{{ orgs.length }}</p>
      </div>
    </section>

    <section v-if="isSuperAdmin" class="mica-card mb-6 rounded-3xl p-6 shadow-sm sm:p-8">
      <div class="mb-6 flex flex-col gap-2 border-b border-g-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-g-accent">super admin</p>
          <h2 class="mt-2 font-mono text-xl font-semibold uppercase tracking-[0.1em] text-g-text">Provision organization</h2>
        </div>
        <p class="font-mono text-xs uppercase tracking-[0.12em] text-g-muted">Registered owner required</p>
      </div>

      <form class="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end" @submit.prevent="createOrg">
        <div class="flex flex-col gap-2 font-mono">
          <label for="org-id" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Organization Slug / ID</label>
          <input
            id="org-id"
            v-model="newOrg.id"
            type="text"
            required
            placeholder="student-council"
            class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
          />
        </div>
        <div class="flex flex-col gap-2 font-mono">
          <label for="org-name" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Organization Name</label>
          <input
            id="org-name"
            v-model="newOrg.name"
            type="text"
            required
            placeholder="APC Student Council"
            class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
          />
        </div>
        <div class="flex flex-col gap-2 font-mono">
          <label for="owner-email" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Owner Email</label>
          <input
            id="owner-email"
            v-model="newOrg.ownerEmail"
            type="email"
            required
            placeholder="president@student.apc.edu.ph"
            class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
          />
        </div>
        <button
          type="submit"
          :disabled="creatingOrg"
          class="rounded-xl bg-g-accent px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          data-cursor="cta"
        >
          {{ creatingOrg ? 'CREATING...' : 'CREATE' }}
        </button>
      </form>
    </section>

    <div v-if="loadingOrgs" class="mica-card h-40 animate-pulse rounded-3xl" />

    <div v-else-if="orgs.length === 0" class="mica-card rounded-3xl p-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-g-muted">
      You do not belong to any organization.
    </div>

    <section v-else class="space-y-6">
      <section class="mica-card rounded-3xl p-6 shadow-sm sm:p-8">
        <div class="mb-6 flex flex-col gap-2 border-b border-g-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-g-accent">owner registry</p>
            <h2 class="mt-2 font-mono text-xl font-semibold uppercase tracking-[0.1em] text-g-text">Organizations I Own</h2>
          </div>
          <span class="font-mono text-xs uppercase tracking-[0.12em] text-g-muted">{{ ownedOrgs.length }} owned</span>
        </div>

        <div v-if="ownedOrgs.length === 0" class="border border-dashed border-g-border p-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-g-muted">
          You do not own an organization.
        </div>

        <div v-else class="space-y-8">
          <article
            v-for="org in ownedOrgs"
            :key="org.org_id"
            class="border-b border-g-border pb-8 last:border-b-0 last:pb-0"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <h3 class="truncate font-mono text-lg font-semibold uppercase tracking-[0.08em] text-g-primary dark:text-white">{{ org.org_name }}</h3>
                <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-g-muted">Created {{ formatDate(org.created_at) }}</p>
              </div>
              <span class="inline-flex w-fit rounded-full border border-g-accent/40 bg-g-accent/10 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-g-accent">
                Owner
              </span>
            </div>

            <div class="mt-7 space-y-7 border-t border-g-border pt-7">
              <div>
                <div class="mb-4 flex items-center justify-between gap-3">
                  <h4 class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-g-muted">Members registry</h4>
                  <span class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-g-muted">{{ members.length }} records</span>
                </div>

                <div v-if="loadingMembers" class="h-20 animate-pulse rounded-xl bg-white/50 dark:bg-slate-800/40" />

                <div v-else class="overflow-x-auto rounded-2xl border border-g-border">
                  <table class="w-full min-w-[520px] border-collapse text-left font-mono">
                    <thead>
                      <tr class="border-b border-g-border bg-white/40 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-g-muted dark:bg-mica-navy-header">
                        <th class="px-4 py-3">Email</th>
                        <th class="px-4 py-3 text-center">Status</th>
                        <th class="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="member in members"
                        :key="member.email"
                        class="border-b border-g-border/70 text-xs last:border-b-0 hover:bg-white/40 dark:hover:bg-mica-navy-row-hover"
                      >
                        <td class="px-4 py-3 text-g-text">{{ member.email }}</td>
                        <td class="px-4 py-3 text-center">
                          <span
                            v-if="member.activated_at"
                            class="inline-flex rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-emerald-500"
                          >
                            Active
                          </span>
                          <span
                            v-else
                            class="inline-flex rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-500"
                          >
                            Pending
                          </span>
                        </td>
                        <td class="px-4 py-3 text-right">
                          <button
                            v-if="currentUser?.email !== member.email"
                            type="button"
                            @click="removeMember(org.org_id, member.email)"
                            :disabled="removingMember === member.email"
                            class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-red-500 transition-colors hover:text-red-600 disabled:opacity-40"
                            data-cursor="nav"
                          >
                            {{ removingMember === member.email ? 'Removing...' : 'Remove' }}
                          </button>
                          <span v-else class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-g-muted">Owner</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="grid gap-6 xl:grid-cols-2">
                <form class="space-y-3" @submit.prevent="sendInvite(org.org_id)">
                  <div>
                    <h4 class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-g-muted">Invite member</h4>
                    <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-g-muted">APC email domains only</p>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <input
                      v-model="inviteEmail"
                      type="email"
                      required
                      placeholder="peer@apc.edu.ph"
                      class="min-w-0 flex-1 rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      :disabled="sendingInvite"
                      class="rounded-lg bg-g-primary px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {{ sendingInvite ? 'Inviting...' : 'Invite' }}
                    </button>
                  </div>
                </form>

                <form class="space-y-3 border-t border-g-border pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" @submit.prevent="promptTransferOwnership(org.org_id)">
                  <div>
                    <h4 class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-red-500">Transfer ownership</h4>
                    <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-g-muted">Permanent owner change</p>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <input
                      v-model="transferEmail"
                      type="email"
                      required
                      placeholder="active-member@apc.edu.ph"
                      class="min-w-0 flex-1 rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-red-500 focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      class="rounded-lg bg-red-500 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-600"
                    >
                      Transfer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="mica-card rounded-3xl p-6 shadow-sm sm:p-8">
        <div class="mb-6 flex flex-col gap-2 border-b border-g-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-g-accent">member registry</p>
            <h2 class="mt-2 font-mono text-xl font-semibold uppercase tracking-[0.1em] text-g-text">Organizations I Belong To</h2>
          </div>
          <span class="font-mono text-xs uppercase tracking-[0.12em] text-g-muted">{{ memberOrgs.length }} memberships</span>
        </div>

        <div v-if="memberOrgs.length === 0" class="border border-dashed border-g-border p-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-g-muted">
          You are not a member of another organization.
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2">
          <article
            v-for="org in memberOrgs"
            :key="org.org_id"
            class="rounded-2xl border border-g-border bg-white/25 p-5 dark:bg-slate-900/20"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h3 class="truncate font-mono text-base font-semibold uppercase tracking-[0.08em] text-g-primary dark:text-white">{{ org.org_name }}</h3>
                <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-g-muted">Joined {{ formatDate(org.created_at) }}</p>
              </div>
              <span class="inline-flex w-fit rounded-full border border-g-border bg-white/30 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-g-muted dark:bg-slate-900/30">
                Member
              </span>
            </div>
          </article>
        </div>
      </section>
    </section>

    <div
      v-if="showTransferModal"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 font-mono backdrop-blur-sm dark:bg-slate-950/80"
      @click.self="showTransferModal = false"
    >
      <div class="relative w-full max-w-md overflow-hidden rounded-2xl border border-g-border bg-g-surface shadow-2xl dark:bg-mica-navy-modal">
        <div class="h-2 w-full bg-red-500" />
        <div class="p-6 sm:p-8">
          <h3 class="mb-3 font-mono text-lg font-black uppercase tracking-[0.12em] text-red-500">Confirm ownership transfer</h3>
          <p class="mb-6 font-mono text-xs leading-relaxed text-g-muted">
            You are about to transfer all management permissions to
            <strong class="text-g-text">{{ transferEmail }}</strong>. You will immediately lose owner privileges. This operation is permanent and irreversible.
          </p>

          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              @click="showTransferModal = false"
              class="rounded-lg border border-g-border px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-g-muted transition-colors hover:border-g-text hover:text-g-text"
            >
              Abort
            </button>
            <button
              type="button"
              @click="executeTransferOwnership"
              :disabled="transferringOwnership"
              class="rounded-lg bg-red-500 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {{ transferringOwnership ? 'TRANSFERRING...' : 'CONFIRM TRANSFER' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'

const toast = useToast()
const { authHeaders, getUser } = useAuth()

const currentUser = getUser()
const isSuperAdmin = computed(() => currentUser?.email === 'arlaus@student.apc.edu.ph')

// Lists
const orgs = ref<any[]>([])
const members = ref<any[]>([])
const ownedOrgs = computed(() => orgs.value.filter((org) => org.is_owner === 1))
const memberOrgs = computed(() => orgs.value.filter((org) => org.is_owner !== 1))

// Loading states
const loadingOrgs = ref(true)
const loadingMembers = ref(false)

// Action states
const sendingInvite = ref(false)
const transferringOwnership = ref(false)
const showTransferModal = ref(false)
const creatingOrg = ref(false)
const removingMember = ref<string | null>(null)

// Inputs
const inviteEmail = ref('')
const transferEmail = ref('')
const activeOrgId = ref('')
const newOrg = ref({
  id: '',
  name: '',
  ownerEmail: '',
})

function formatDate(d: string) {
  if (!d) return ''
  const t = d.replace(' ', 'T')
  try {
    return new Date(t).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch {
    return d
  }
}

// Fetch organizations the user actively belongs to or owns.
async function fetchOrgs() {
  loadingOrgs.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, {
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      orgs.value = data.orgs || []

      // Backend currently enforces one owned org per user.
      const ownedOrg = orgs.value.find(o => o.is_owner === 1)
      if (ownedOrg) {
        await fetchMembers(ownedOrg.org_id)
      } else {
        members.value = []
      }
    } else {
      throw new Error(data.error || 'Failed to fetch organizations')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    loadingOrgs.value = false
  }
}

// Fetch members of an owned org
async function fetchMembers(orgId: string) {
  loadingMembers.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${orgId}/members`, {
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      members.value = data.members || []
    } else {
      throw new Error(data.error || 'Failed to fetch members registry')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    loadingMembers.value = false
  }
}

// Send an invitation
async function sendInvite(orgId: string) {
  const email = inviteEmail.value.toLowerCase().trim()
  const apcEmailRegex = /^[a-zA-Z0-9._%+-]+@(?:student\.)?apc\.edu\.ph$/

  if (!apcEmailRegex.test(email)) {
    toast.error('Invalid domain. Email must belong to @apc.edu.ph or @student.apc.edu.ph')
    return
  }

  sendingInvite.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${orgId}/members`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Invitation successfully processed.')
      inviteEmail.value = ''
      await fetchMembers(orgId)
    } else {
      throw new Error(data.error || 'Failed to send invitation')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    sendingInvite.value = false
  }
}

// Prompt transfer ownership
function promptTransferOwnership(orgId: string) {
  const email = transferEmail.value.toLowerCase().trim()
  if (!email) {
    toast.error('Please enter the active member\'s email address.')
    return
  }
  activeOrgId.value = orgId
  showTransferModal.value = true
}

// Execute transfer ownership
async function executeTransferOwnership() {
  const email = transferEmail.value.toLowerCase().trim()
  transferringOwnership.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${activeOrgId.value}/transfer`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetEmail: email })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Organization ownership successfully transferred.')
      showTransferModal.value = false
      transferEmail.value = ''
      await fetchOrgs()
    } else {
      throw new Error(data.error || 'Failed to transfer ownership')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    transferringOwnership.value = false
  }
}

async function removeMember(orgId: string, email: string) {
  if (!confirm(`Are you sure you want to remove ${email} from this organization?`)) return
  removingMember.value = email
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${orgId}/members`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`${email} has been successfully removed.`)
      await fetchMembers(orgId)
    } else {
      throw new Error(data.error || 'Failed to remove member')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    removingMember.value = null
  }
}

async function createOrg() {
  const id = newOrg.value.id.toLowerCase().trim()
  const name = newOrg.value.name.trim()
  const ownerEmail = newOrg.value.ownerEmail.toLowerCase().trim()

  if (!/^[a-z0-9-]+$/.test(id)) {
    toast.error('Invalid ID. Slug must contain only lowercase letters, numbers, and hyphens.')
    return
  }

  creatingOrg.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, name, ownerEmail })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message || 'Organization successfully created!')
      newOrg.value.id = ''
      newOrg.value.name = ''
      newOrg.value.ownerEmail = ''
      await fetchOrgs()
    } else {
      throw new Error(data.error || 'Failed to create organization')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    creatingOrg.value = false
  }
}

onMounted(() => {
  fetchOrgs()
})
</script>

<template>
  <div class="w-full min-h-full">
    <!-- Page dot grid background alignment -->
    <div class="min-h-screen bg-[#F5F5F5] dark:bg-slate-950 text-gray-800 dark:text-slate-200 flex flex-col items-center py-24 px-6 relative z-10">
      
      <!-- Centralized Brutalist Card Layout -->
      <div class="w-full max-w-xl bg-white dark:bg-mica-navy-card border border-gray-300 dark:border-slate-600 p-8 md:p-10 shadow-2xl relative dark:backdrop-blur-xl">
        <div class="absolute top-0 left-0 w-full h-2 bg-[#34418F]"></div>

        <!-- Header -->
        <div class="border-b-2 border-gray-200 dark:border-slate-600 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200 uppercase tracking-widest mb-1">ORGANIZATIONS</h1>
            <p class="font-mono text-xs text-gray-500 dark:text-slate-400 uppercase tracking-widest">Multi-Tenant Management</p>
          </div>
          <router-link to="/dashboard" class="font-mono text-xs font-bold text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-wider transition-colors">
            ← DASHBOARD
          </router-link>
        </div>

        <!-- SECTION 0: SUPER-ADMIN CREATION PORTAL -->
        <div v-if="isSuperAdmin" class="mb-10 font-mono border border-dashed border-[#DEAC4B] p-5 rounded-lg bg-[#DEAC4B]/5 dark:bg-[#DEAC4B]/5">
          <h2 class="text-sm font-bold text-[#DEAC4B] uppercase tracking-widest mb-1">SUPER ADMIN PORTAL</h2>
          <p class="text-[9px] text-gray-400 uppercase tracking-wider mb-4">Create & Provision New Organization</p>
          
          <form @submit.prevent="createOrg" class="space-y-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Organization Slug / ID</label>
              <input 
                v-model="newOrg.id" 
                type="text" 
                required 
                placeholder="e.g., student-council"
                class="bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none focus:border-[#DEAC4B] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Organization Name</label>
              <input 
                v-model="newOrg.name" 
                type="text" 
                required 
                placeholder="e.g., APC Student Council"
                class="bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none focus:border-[#DEAC4B] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Owner Email (Must be registered user)</label>
              <input 
                v-model="newOrg.ownerEmail" 
                type="email" 
                required 
                placeholder="e.g., president@student.apc.edu.ph"
                class="bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none focus:border-[#DEAC4B] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>
            <button 
              type="submit" 
              :disabled="creatingOrg"
              class="w-full bg-[#DEAC4B] hover:bg-[#c5963b] text-white text-xs font-bold uppercase tracking-widest py-3 rounded transition-colors disabled:opacity-50"
              data-cursor="cta"
            >
              {{ creatingOrg ? 'CREATING...' : 'CREATE ORGANIZATION' }}
            </button>
          </form>
        </div>

        <!-- SECTION 1: PENDING INVITATIONS -->
        <div class="mb-10 font-mono">
          <h2 class="text-sm font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest mb-4">PENDING INVITATIONS</h2>
          
          <div v-if="loadingInvites" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800/40 mb-4" />
          
          <div v-else-if="invites.length === 0" class="border border-dashed border-gray-300 dark:border-slate-700 p-6 text-center text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            No pending invitations.
          </div>
          
          <div v-else class="space-y-3">
            <div v-for="invite in invites" :key="invite.org_id" class="flex flex-col sm:flex-row sm:items-center justify-between border border-gray-200 dark:border-slate-700 p-4 rounded-lg bg-gray-50/50 dark:bg-slate-900/30 gap-3">
              <div>
                <p class="font-bold text-sm text-gray-800 dark:text-slate-200 uppercase tracking-wider">{{ invite.org_name }}</p>
                <p class="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Invited: {{ formatDate(invite.invited_at) }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  @click="acceptInvite(invite.org_id, invite.org_name)"
                  :disabled="processingInvite"
                  class="bg-[#DEAC4B] hover:bg-[#c5963b] text-white text-xs font-bold uppercase tracking-wider py-2 px-4 rounded transition-colors disabled:opacity-50"
                  data-cursor="cta"
                >
                  Accept
                </button>
                <button
                  @click="declineInvite(invite.org_id, invite.org_name)"
                  :disabled="processingInvite"
                  class="border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-800/60 text-gray-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider py-2 px-4 rounded transition-colors disabled:opacity-50"
                  data-cursor="nav"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: MY ORGANIZATIONS -->
        <div class="mb-10 font-mono">
          <h2 class="text-sm font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest mb-4">MY ORGANIZATIONS</h2>
          
          <div v-if="loadingOrgs" class="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800/40" />
          
          <div v-else-if="orgs.length === 0" class="border border-dashed border-gray-300 dark:border-slate-700 p-6 text-center text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            You do not belong to any organization.
          </div>
          
          <div v-else class="space-y-4">
            <div 
              v-for="org in orgs" 
              :key="org.org_id" 
              class="border border-gray-200 dark:border-slate-700 p-5 rounded-lg"
              :class="org.is_owner === 1 ? 'border-l-4 border-l-[#DEAC4B]' : ''"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-base font-bold text-[#34418F] dark:text-slate-200 uppercase tracking-wider">{{ org.org_name }}</h3>
                  <p class="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Joined: {{ formatDate(org.created_at) }}</p>
                </div>
                <div>
                  <span 
                    v-if="org.is_owner === 1" 
                    class="text-[9px] font-bold bg-[#DEAC4B]/10 text-[#DEAC4B] border border-[#DEAC4B]/30 px-2 py-0.5 rounded-full uppercase tracking-wider"
                  >
                    Owner
                  </span>
                  <span 
                    v-else 
                    class="text-[9px] font-bold bg-[#34418F]/10 text-[#34418F] border border-[#34418F]/30 dark:text-slate-300 dark:border-slate-500 dark:bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider"
                  >
                    Member
                  </span>
                </div>
              </div>

              <!-- OWNER ACTIONS SECTION (Only visible if the user is the owner) -->
              <div v-if="org.is_owner === 1" class="mt-6 border-t border-gray-100 dark:border-slate-700 pt-6 space-y-6">
                
                <!-- Members list -->
                <div>
                  <h4 class="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">MEMBERS REGISTRY</h4>
                  
                  <div v-if="loadingMembers" class="h-16 animate-pulse rounded bg-gray-100 dark:bg-slate-800/40" />
                  
                  <div v-else class="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
                    <table class="w-full text-left border-collapse">
                      <thead>
                        <tr class="bg-gray-50/60 dark:bg-mica-navy-header border-b border-gray-200 dark:border-slate-700">
                          <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-300">Email</th>
                          <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-300 text-center">Status</th>
                          <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-300 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr 
                          v-for="member in members" 
                          :key="member.email" 
                          class="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-mica-navy-row-hover last:border-b-0"
                        >
                          <td class="px-3 py-2 text-xs font-medium text-gray-800 dark:text-slate-200">{{ member.email }}</td>
                          <td class="px-3 py-2 text-center">
                            <span 
                              v-if="member.activated_at" 
                              class="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wide inline-block"
                            >
                              Active
                            </span>
                            <span 
                              v-else 
                              class="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wide inline-block"
                            >
                              Pending
                            </span>
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button 
                              v-if="currentUser?.email !== member.email"
                              @click="removeMember(org.org_id, member.email)"
                              :disabled="removingMember === member.email"
                              class="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                              data-cursor="nav"
                            >
                              {{ removingMember === member.email ? 'Removing...' : 'Remove' }}
                            </button>
                            <span v-else class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Owner</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Invite Peer Form -->
                <div>
                  <h4 class="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">INVITE NEW MEMBER</h4>
                  <form @submit.prevent="sendInvite(org.org_id)" class="flex gap-2">
                    <input 
                      v-model="inviteEmail" 
                      type="email" 
                      required 
                      placeholder="peer@apc.edu.ph"
                      class="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
                    />
                    <button 
                      type="submit" 
                      :disabled="sendingInvite"
                      class="bg-[#34418F] hover:bg-[#2a3578] text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-colors disabled:opacity-50"
                    >
                      {{ sendingInvite ? 'Inviting...' : 'Invite' }}
                    </button>
                  </form>
                  <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Must be @apc.edu.ph or @student.apc.edu.ph email.</p>
                </div>

                <!-- Transfer Ownership Form -->
                <div class="border-t border-gray-100 dark:border-slate-700 pt-6">
                  <h4 class="text-xs font-bold text-[#ef4444] uppercase tracking-wider mb-2">DESTRUCTIVE ZONE</h4>
                  <p class="text-[11px] text-gray-400 mb-3 leading-relaxed">
                    Transfer organization ownership to an active member. This action is irreversible, and you will lose owner privileges.
                  </p>
                  <form @submit.prevent="promptTransferOwnership(org.org_id)" class="flex gap-2">
                    <input 
                      v-model="transferEmail" 
                      type="email" 
                      required 
                      placeholder="active-member@apc.edu.ph"
                      class="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none focus:border-[#ef4444] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
                    />
                    <button 
                      type="submit" 
                      class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-colors"
                    >
                      Transfer
                    </button>
                  </form>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- IRREVERSIBLE TRANSFER CONFIRMATION MODAL -->
    <div 
      v-if="showTransferModal" 
      class="fixed inset-0 z-50 bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity flex items-center justify-center p-4 font-mono"
    >
      <div class="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden p-6 md:p-8">
        <!-- Danger Stripe Motif -->
        <div class="absolute top-0 left-0 w-full h-2 bg-[#ef4444]"></div>

        <h3 class="text-lg font-black text-[#ef4444] uppercase tracking-wider mb-3">CONFIRM OWNERSHIP TRANSFER</h3>
        
        <p class="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-6 uppercase">
          You are about to transfer all management permissions of the organization to <strong class="text-gray-800 dark:text-slate-200">{{ transferEmail }}</strong>. 
          You will immediately lose ownership rights, including the ability to invite members, manage keys, and execute administrative actions.
          This operation is <span class="text-[#ef4444] font-bold">permanent and irreversible</span>.
        </p>

        <div class="flex gap-3 justify-end">
          <button 
            @click="showTransferModal = false"
            class="border border-gray-300 hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider py-3 px-5 rounded-lg transition-colors"
          >
            Abort
          </button>
          <button 
            @click="executeTransferOwnership"
            :disabled="transferringOwnership"
            class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider py-3 px-5 rounded-lg transition-colors disabled:opacity-50"
          >
            {{ transferringOwnership ? 'TRANSFERRING...' : 'CONFIRM TRANSFER' }}
          </button>
        </div>
      </div>
    </div>
  </div>
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
const invites = ref<any[]>([])
const orgs = ref<any[]>([])
const members = ref<any[]>([])

// Loading states
const loadingInvites = ref(true)
const loadingOrgs = ref(true)
const loadingMembers = ref(false)

// Action states
const processingInvite = ref(false)
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

// Fetch pending invites
async function fetchInvites() {
  loadingInvites.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/invites`, {
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      invites.value = data.invites || []
    } else {
      throw new Error(data.error || 'Failed to fetch invitations')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    loadingInvites.value = false
  }
}

// Fetch organizations the user belongs to/owns
async function fetchOrgs() {
  loadingOrgs.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, {
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      orgs.value = data.orgs || []
      
      // If user owns an org, fetch its members automatically
      const ownedOrg = orgs.value.find(o => o.is_owner === 1)
      if (ownedOrg) {
        await fetchMembers(ownedOrg.org_id)
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

// Accept an invite
async function acceptInvite(orgId: string, orgName: string) {
  processingInvite.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/invites/${orgId}/accept`, {
      method: 'POST',
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Welcome to ${orgName}!`)
      await fetchInvites()
      await fetchOrgs()
    } else {
      throw new Error(data.error || 'Failed to accept invitation')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    processingInvite.value = false
  }
}

// Decline an invite
async function declineInvite(orgId: string, orgName: string) {
  if (!confirm(`Are you sure you want to decline the invitation to join ${orgName}?`)) return
  processingInvite.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/invites/${orgId}/decline`, {
      method: 'POST',
      headers: authHeaders()
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Invitation to ${orgName} declined.`)
      await fetchInvites()
    } else {
      throw new Error(data.error || 'Failed to decline invitation')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    processingInvite.value = false
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
      await fetchOrgs() // Refresh lists
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
  fetchInvites()
  fetchOrgs()
})
</script>

<template>
  <div>
    <router-link
      to="/settings/org-management"
      class="mb-6 inline-flex text-sm font-medium text-g-muted transition-colors hover:text-g-accent"
      data-cursor="nav"
    >
      ← Back to org management
    </router-link>

    <section class="mica-card rounded-3xl p-6 sm:p-8">
      <header class="mb-6 border-b border-g-border pb-5">
        <h2 class="text-section-title">
          {{ isCreate ? 'New org' : 'Edit org' }}
        </h2>
      </header>

      <form class="space-y-5" @submit.prevent="save">
        <div class="flex flex-col gap-2">
          <label for="org-slug" class="text-sm font-medium text-g-muted">Org slug</label>
          <input id="org-slug" v-model="form.id" type="text" required class="field-input text-data" placeholder="jpcs" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="org-name" class="text-sm font-medium text-g-muted">Org name</label>
          <input id="org-name" v-model="form.name" type="text" required class="field-input" placeholder="Junior Philippine Computer Society" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="owner-email" class="text-sm font-medium text-g-muted">Owner email</label>
          <input id="owner-email" v-model="form.ownerEmail" type="email" required class="field-input" placeholder="president@student.apc.edu.ph" />
        </div>

        <div v-if="!isCreate" class="flex items-center justify-between rounded-2xl border border-g-border p-4">
          <span class="text-sm font-medium text-g-text">List in /orgs directory</span>
          <button
            type="button"
            role="switch"
            :aria-checked="form.isPublicCatalog"
            :aria-label="form.isPublicCatalog ? 'Remove from directory' : 'List in directory'"
            class="relative h-7 w-12 rounded-full transition-colors"
            :class="form.isPublicCatalog ? 'bg-g-accent' : 'bg-gray-300 dark:bg-slate-600'"
            @click="form.isPublicCatalog = !form.isPublicCatalog"
          >
            <span
              class="pointer-events-none absolute left-0.5 top-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform"
              :class="form.isPublicCatalog ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="flex flex-wrap gap-3">
          <button type="submit" :disabled="saving" class="btn-primary" data-cursor="cta">
            {{ saving ? 'Saving...' : isCreate ? 'Create org' : 'Save changes' }}
          </button>
          <button
            v-if="!isCreate"
            type="button"
            :disabled="deleting"
            class="rounded-xl border border-red-500 px-5 py-3 text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50"
            @click="deleteOrg"
          >
            {{ deleting ? 'Deleting...' : 'Delete org' }}
          </button>
        </div>
      </form>

      <form v-if="!isCreate" class="mt-10 space-y-3 border-t border-g-border pt-8" @submit.prevent="showTransferModal = true">
        <h3 class="text-card-title text-red-500">Transfer ownership</h3>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input v-model="transferEmail" type="email" required placeholder="active-member@apc.edu.ph" class="field-input min-w-0 flex-1" />
          <button type="submit" class="rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white">Transfer</button>
        </div>
      </form>
    </section>

    <div
      v-if="showTransferModal"
      role="dialog"
      aria-labelledby="admin-transfer-title"
      aria-modal="true"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      @click.self="showTransferModal = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-6 shadow-2xl">
        <p id="admin-transfer-title" class="mb-6 text-sm text-g-muted">Transfer ownership to <strong>{{ transferEmail }}</strong>?</p>
        <div class="flex justify-end gap-3">
          <button type="button" class="rounded-lg border px-4 py-2 text-sm font-medium" @click="showTransferModal = false">Cancel</button>
          <button type="button" :disabled="transferring" class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white" @click="executeTransfer">
            {{ transferring ? 'Transferring...' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { authHeaders } = useAuth()
const toast = useToast()

const isCreate = computed(() => route.name === 'settings-org-management-new')

const form = ref({
  id: '',
  name: '',
  ownerEmail: '',
  isPublicCatalog: false,
})

const saving = ref(false)
const deleting = ref(false)
const transferring = ref(false)
const showTransferModal = ref(false)
const transferEmail = ref('')

async function loadOrg() {
  if (isCreate.value) return
  const orgId = route.params.orgId as string
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/admin/${orgId}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load org.')
    form.value = {
      id: data.org.org_id,
      name: data.org.org_name,
      ownerEmail: data.org.owner_email,
      isPublicCatalog: Number(data.org.is_public_catalog) === 1,
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load org.')
    router.push('/settings/org-management')
  }
}

async function save() {
  saving.value = true
  try {
    if (isCreate.value) {
      const res = await fetch(`${API_BASE_URL}/api/orgs`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.value.id.toLowerCase().trim(),
          name: form.value.name.trim(),
          ownerEmail: form.value.ownerEmail.toLowerCase().trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed.')
      toast.success('Org created.')
      router.push({ name: 'settings-org-management-edit', params: { orgId: form.value.id.toLowerCase().trim() } })
    } else {
      const orgId = route.params.orgId as string
      const payload: Record<string, unknown> = {
        name: form.value.name.trim(),
        ownerEmail: form.value.ownerEmail.toLowerCase().trim(),
        isPublicCatalog: form.value.isPublicCatalog,
      }
      const newId = form.value.id.toLowerCase().trim()
      if (newId !== orgId) payload.id = newId

      const res = await fetch(`${API_BASE_URL}/api/orgs/admin/${orgId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed.')
      toast.success('Org updated.')
      if (data.org?.org_id && data.org.org_id !== orgId) {
        router.replace({ name: 'settings-org-management-edit', params: { orgId: data.org.org_id } })
      }
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Save failed.')
  } finally {
    saving.value = false
  }
}

async function deleteOrg() {
  if (!confirm('Delete this org permanently?')) return
  deleting.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/admin/${route.params.orgId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Delete failed.')
    toast.success('Org deleted.')
    router.push('/settings/org-management')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deleting.value = false
  }
}

async function executeTransfer() {
  transferring.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${route.params.orgId}/transfer`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: transferEmail.value.toLowerCase().trim() }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Transfer failed.')
    toast.success('Ownership transferred.')
    showTransferModal.value = false
    await loadOrg()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Transfer failed.')
  } finally {
    transferring.value = false
  }
}

onMounted(loadOrg)
</script>

<style scoped>
.field-input {
  @apply rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white disabled:opacity-60 dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500;
}
.btn-primary {
  @apply rounded-xl bg-g-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50;
}
</style>

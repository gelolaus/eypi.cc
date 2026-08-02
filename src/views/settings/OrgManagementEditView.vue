<template>
  <div>
    <Button
      variant="ghost"
      size="sm"
      className="mb-6"
      @click="router.push('/settings/org-management')"
    >
      ← Back to org management
    </Button>

    <Card>
      <header class="mb-6 border-b border-g-border pb-5">
        <h2 class="font-display text-xl font-semibold text-g-text">
          {{ isCreate ? 'New org' : 'Edit org' }}
        </h2>
      </header>

      <form class="space-y-5" @submit.prevent="save">
        <div class="flex flex-col gap-2">
          <label for="org-slug" class="text-sm font-medium text-g-muted">Org slug</label>
          <Input
            id="org-slug"
            :value="form.id"
            type="text"
            required
            className="text-data"
            placeholder="jpcs"
            @input="onIdInput"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="org-name" class="text-sm font-medium text-g-muted">Org name</label>
          <Input
            id="org-name"
            :value="form.name"
            type="text"
            required
            placeholder="Junior Philippine Computer Society"
            @input="onNameInput"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="owner-email" class="text-sm font-medium text-g-muted">Owner email</label>
          <Input
            id="owner-email"
            :value="form.ownerEmail"
            type="email"
            required
            placeholder="president@student.apc.edu.ph"
            @input="onOwnerEmailInput"
          />
        </div>

        <div v-if="!isCreate" class="flex items-center justify-between rounded-2xl border border-g-border p-4">
          <span class="text-sm font-medium text-g-text">List in /orgs directory</span>
          <Switch
            v-model="form.isPublicCatalog"
            :aria-label="form.isPublicCatalog ? 'Remove from directory' : 'List in directory'"
          />
        </div>

        <div class="flex flex-wrap gap-3">
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Saving...' : isCreate ? 'Create org' : 'Save changes' }}
          </Button>
          <Button
            v-if="!isCreate"
            type="button"
            variant="destructive"
            :disabled="deleting"
            @click="deleteOrg"
          >
            {{ deleting ? 'Deleting...' : 'Delete org' }}
          </Button>
        </div>
      </form>

      <form v-if="!isCreate" class="mt-10 space-y-3 border-t border-g-border pt-8" @submit.prevent="confirmTransfer">
        <h3 class="font-display text-lg font-semibold text-g-destructive">Transfer ownership</h3>
        <div class="flex flex-col gap-2 sm:flex-row">
          <Input
            :value="transferEmail"
            type="email"
            required
            placeholder="active-member@apc.edu.ph"
            className="min-w-0 flex-1"
            @input="onTransferEmailInput"
          />
          <Button type="submit" variant="destructive" :disabled="transferring">
            {{ transferring ? 'Transferring...' : 'Transfer' }}
          </Button>
        </div>
      </form>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Switch from '@/components/ui/Switch.vue'

const route = useRoute()
const router = useRouter()
const { authHeaders } = useAuth()
const toast = useToast()
const dialog = useDialog()

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
const transferEmail = ref('')

function onIdInput(e: Event) {
  form.value.id = (e.target as HTMLInputElement).value
}
function onNameInput(e: Event) {
  form.value.name = (e.target as HTMLInputElement).value
}
function onOwnerEmailInput(e: Event) {
  form.value.ownerEmail = (e.target as HTMLInputElement).value
}
function onTransferEmailInput(e: Event) {
  transferEmail.value = (e.target as HTMLInputElement).value
}

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
  const orgName = form.value.name || form.value.id
  const ok = await dialog.confirm({
    title: 'Delete this org?',
    body: `Permanently removes "${orgName}". This cannot be undone.`,
    confirmLabel: 'Delete org',
    requireText: orgName,
  })
  if (!ok) return
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

async function confirmTransfer() {
  const targetEmail = transferEmail.value.toLowerCase().trim()
  const orgName = form.value.name || form.value.id
  const ok = await dialog.confirm({
    title: 'Transfer ownership?',
    body: `Transfers "${orgName}" to ${targetEmail}. The current owner will lose ownership.`,
    confirmLabel: 'Transfer ownership',
    requireText: orgName,
  })
  if (!ok) return
  await executeTransfer()
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
    await loadOrg()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Transfer failed.')
  } finally {
    transferring.value = false
  }
}

onMounted(loadOrg)
</script>

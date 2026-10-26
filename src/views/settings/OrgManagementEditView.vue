<template>
  <div class="space-y-6">
    <Button
      as-child
      variant="ghost"
      class="-ml-3 w-fit text-muted-foreground"
    >
      <router-link to="/admin/orgs">
        ← Back to org management
      </router-link>
    </Button>

    <Card class="gap-0 rounded-3xl p-6 sm:p-8">
      <h2 class="mb-6 border-b border-border pb-5 font-heading text-xl font-semibold tracking-tight">
        {{ isCreate ? 'New org' : 'Edit org' }}
      </h2>

      <form
        class="space-y-5"
        @submit.prevent="save"
      >
        <div class="flex flex-col gap-2">
          <Label for="org-slug">Org slug</Label>
          <Input
            id="org-slug"
            v-model="form.id"
            type="text"
            required
            class="font-mono"
            placeholder="jpcs"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="org-name">Org name</Label>
          <Input
            id="org-name"
            v-model="form.name"
            type="text"
            required
            placeholder="Junior Philippine Computer Society"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="owner-email">Owner email</Label>
          <Input
            id="owner-email"
            v-model="form.ownerEmail"
            type="email"
            required
            placeholder="president@student.apc.edu.ph"
          />
        </div>

        <div
          v-if="!isCreate"
          class="flex items-center justify-between gap-4 rounded-2xl border border-border p-4"
        >
          <span class="text-sm font-medium">List in /orgs directory</span>
          <button
            type="button"
            role="switch"
            :aria-checked="form.isPublicCatalog"
            :aria-label="form.isPublicCatalog ? 'Remove from directory' : 'List in directory'"
            class="flex h-11 w-14 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="form.isPublicCatalog = !form.isPublicCatalog"
          >
            <span
              class="relative block h-7 w-12 rounded-full transition-colors"
              :class="form.isPublicCatalog ? 'bg-primary' : 'bg-input'"
            >
              <span
                class="pointer-events-none absolute left-0.5 top-0.5 block size-6 rounded-full bg-background shadow transition-transform"
                :class="form.isPublicCatalog ? 'translate-x-5' : 'translate-x-0'"
              />
            </span>
          </button>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <Button
            type="submit"
            :disabled="saving"
            class="px-6"
          >
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
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'

interface AdminOrgRow {
  org_id: string
  org_name: string
  owner_email: string
  is_public_catalog: number
}

interface AdminOrgResponse {
  error?: string
  org?: AdminOrgRow
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()

const isCreate = computed(() => route.name === 'admin-orgs-new')

const form = ref({
  id: '',
  name: '',
  ownerEmail: '',
  isPublicCatalog: false,
})

const saving = ref(false)
const deleting = ref(false)

async function loadOrg() {
  if (isCreate.value) return
  const orgId = route.params.orgId as string
  try {
    const res = await api.raw(`/api/orgs/admin/${orgId}`)
    const data = await res.json() as AdminOrgResponse
    if (!res.ok) throw new Error(data.error || 'Failed to load org.')
    form.value = {
      id: data.org!.org_id,
      name: data.org!.org_name,
      ownerEmail: data.org!.owner_email,
      isPublicCatalog: Number(data.org!.is_public_catalog) === 1,
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load org.')
    router.push('/admin/orgs')
  }
}

async function save() {
  saving.value = true
  try {
    if (isCreate.value) {
      const res = await api.raw(`/api/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.value.id.toLowerCase().trim(),
          name: form.value.name.trim(),
          ownerEmail: form.value.ownerEmail.toLowerCase().trim(),
        }),
      })
      const data = await res.json() as AdminOrgResponse
      if (!res.ok) throw new Error(data.error || 'Create failed.')
      toast.success('Org created.')
      router.push({ name: 'admin-orgs-edit', params: { orgId: form.value.id.toLowerCase().trim() } })
    } else {
      const orgId = route.params.orgId as string
      const payload: Record<string, unknown> = {
        name: form.value.name.trim(),
        ownerEmail: form.value.ownerEmail.toLowerCase().trim(),
        isPublicCatalog: form.value.isPublicCatalog,
      }
      const newId = form.value.id.toLowerCase().trim()
      if (newId !== orgId) payload.id = newId

      const res = await api.raw(`/api/orgs/admin/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as AdminOrgResponse
      if (!res.ok) throw new Error(data.error || 'Save failed.')
      toast.success('Org updated.')
      if (data.org?.org_id && data.org.org_id !== orgId) {
        router.replace({ name: 'admin-orgs-edit', params: { orgId: data.org.org_id } })
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
    const res = await api.raw(`/api/orgs/admin/${route.params.orgId}`, { method: 'DELETE' })
    const data = await res.json() as { error?: string }
    if (!res.ok) throw new Error(data.error || 'Delete failed.')
    toast.success('Org deleted.')
    router.push('/admin/orgs')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deleting.value = false
  }
}

onMounted(loadOrg)
</script>


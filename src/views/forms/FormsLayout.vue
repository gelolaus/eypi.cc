<template>
  <PageSkeleton v-if="loading" />

  <div v-else-if="isLocked" class="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
    <OrgLockout />
  </div>

  <router-view v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrgMembership } from '@/composables/useOrgMembership'
import PageSkeleton from '@/components/PageSkeleton.vue'
import OrgLockout from '@/components/OrgLockout.vue'

const { checkOrgMembership } = useOrgMembership()

const loading = ref(true)
const isLocked = ref(false)

onMounted(async () => {
  isLocked.value = !(await checkOrgMembership())
  loading.value = false
})
</script>

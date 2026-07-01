<template>
  <div v-if="loading" class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div v-for="i in 2" :key="i" class="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
    </div>
  </div>

  <div v-else-if="isLocked" class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col min-h-[calc(100vh-5rem)] flex-1 items-center justify-center">
    <OrgLockout />
  </div>

  <router-view v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrgMembership } from '@/composables/useOrgMembership'
import OrgLockout from '@/components/OrgLockout.vue'

const { checkOrgMembership } = useOrgMembership()

const loading = ref(true)
const isLocked = ref(false)

onMounted(async () => {
  isLocked.value = !(await checkOrgMembership())
  loading.value = false
})
</script>

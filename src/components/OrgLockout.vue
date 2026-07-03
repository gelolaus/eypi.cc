<template>
  <div class="flex w-full flex-col items-center justify-center py-12">
    <!-- Access Restricted Hardware Card -->
    <div
      class="mica-card relative flex w-full max-w-md flex-col items-center rounded-3xl border border-gray-200 p-8 text-center shadow-xl sm:p-12 dark:border-slate-700"
    >
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner dark:bg-slate-600" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner dark:bg-slate-600" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner dark:bg-slate-600" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner dark:bg-slate-600" />

      <!-- Icon / Symbol -->
      <div class="mb-4 text-[#ef4444]">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <!-- Header -->
      <h1
        class="mb-2 font-mono text-2xl font-black uppercase tracking-widest text-[#34418F] dark:text-slate-200"
      >
        Access Restricted
      </h1>

      <!-- Subtitle -->
      <h2
        class="mb-6 font-mono text-xs font-bold uppercase tracking-widest text-[#DEAC4B]"
      >
        Organization Membership Required
      </h2>

      <!-- Body -->
      <p
        class="mb-8 font-mono text-xs leading-relaxed text-gray-500 dark:text-slate-400"
      >
        Creation and management tools are strictly locked to student organizations.
        You must be an active member of an organization to access this feature.
        If you have a pending invitation, accept it in the Orgs module.
      </p>

      <!-- CTA -->
      <router-link
        to="/orgs/modify"
        class="rounded-xl bg-[#DEAC4B] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:scale-105 sm:px-8 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
        data-cursor="cta"
      >
        Manage orgs
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
// Lockout view triggers when a user tries to access /manage/frames or /manage/tix without organization access.
</script>

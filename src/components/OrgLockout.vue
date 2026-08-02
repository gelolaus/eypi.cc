<template>
  <div class="flex w-full flex-col items-center justify-center py-12">
    <Card className="flex w-full max-w-md flex-col items-center text-center">
      <div class="mb-4 text-g-destructive">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h1 class="mb-2 font-display text-2xl font-bold text-g-text">
        Access restricted
      </h1>

      <p class="mb-8 text-sm leading-relaxed text-g-muted">
        This feature is for active student-organization members only.
        If you have a pending invitation, accept it in the Orgs module.
      </p>

      <router-link
        to="/orgs/modify"
        :class="buttonVariants({ variant: 'primary' })"
      >
        Manage orgs
      </router-link>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'
</script>

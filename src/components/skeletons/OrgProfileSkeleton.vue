<template>
  <div
    role="status"
    aria-busy="true"
  >
    <span class="sr-only">Loading</span>
    <!-- hero card: banner + name block; tabs row (44px + mb-6); about card; mb-8 between hero and tabs -->
    <div class="md:hidden">
      <Skeleton
        data-skeleton-hero
        :h="368"
        :radius="24"
      />
    </div>
    <div class="hidden md:block">
      <Skeleton
        data-skeleton-hero-md
        :h="412"
        :radius="24"
      />
    </div>
    <Skeleton
      class="mt-8"
      data-skeleton-tabs
      :w="280"
      :h="44"
      :radius="12"
    />
    <Skeleton
      class="mt-6"
      data-skeleton-body
      :h="200"
      :radius="24"
    />
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'
</script>

<template>
  <LegalLayout>
    <div
      v-if="document"
      class="mb-10 border-b border-gray-200 pb-8 dark:border-slate-700"
    >
      <h1 class="text-section-title mb-1">
        {{ document.title }}
      </h1>
      <p class="text-data text-xs text-gray-500 dark:text-slate-400">
        Version {{ document.version }}
      </p>
      <p class="text-data text-xs text-gray-500 dark:text-slate-400">
        Effective {{ document.effectiveDate }}
      </p>
    </div>

    <div
      v-if="document"
      class="space-y-8 text-sm leading-relaxed"
    >
      <section
        v-for="(section, index) in document.sections"
        :key="`${section.heading}-${index}`"
      >
        <h2 class="text-card-title mb-4 border-b border-gray-200 pb-2 dark:border-slate-700">
          {{ section.heading }}
        </h2>
        <p
          v-for="(paragraph, paragraphIndex) in section.paragraphs"
          :key="paragraphIndex"
          class="mb-4 text-gray-600 last:mb-0 dark:text-slate-400"
        >
          {{ paragraph }}
        </p>
      </section>
    </div>
  </LegalLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LegalLayout from '@/components/LegalLayout.vue'
import { acceptableUse } from '@/legal/acceptable-use'
import { privacy } from '@/legal/privacy'
import { terms } from '@/legal/terms'
import type { LegalDocument } from '@/legal/types'

const documents: Record<string, LegalDocument> = {
  privacy,
  terms,
  'acceptable-use': acceptableUse,
}

const route = useRoute()

const document = computed(() => documents[String(route.name)] ?? null)
</script>

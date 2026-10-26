<template>
  <LegalLayout>
    <div
      v-if="document"
      class="mb-10 max-w-prose border-b border-border pb-8"
    >
      <h1 class="mb-2 font-heading text-3xl font-semibold tracking-tight">
        {{ document.title }}
      </h1>
      <p class="font-mono text-xs text-muted-foreground">
        Version {{ document.version }}
      </p>
      <p class="font-mono text-xs text-muted-foreground">
        Effective {{ document.effectiveDate }}
      </p>
    </div>

    <div
      v-if="document"
      class="max-w-prose space-y-8 text-sm leading-relaxed"
    >
      <section
        v-for="(section, index) in document.sections"
        :key="`${section.heading}-${index}`"
      >
        <h2 class="mb-4 border-b border-border pb-2 font-heading text-lg font-semibold tracking-tight">
          {{ section.heading }}
        </h2>
        <p
          v-for="(paragraph, paragraphIndex) in section.paragraphs"
          :key="paragraphIndex"
          class="mb-4 text-muted-foreground last:mb-0"
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

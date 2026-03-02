<template>
  <form @submit.prevent="handleSubmit" novalidate class="mb-4 flex w-full max-w-2xl flex-col gap-4 md:mb-8 md:flex-row">
    <input
      id="url"
      :value="props.modelValue"
      type="text"
      placeholder="Paste your long link here..."
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="w-full rounded-xl border-2 border-gray-300 bg-white px-6 py-4 text-lg text-slate-900 outline-none transition-colors placeholder-slate-500 focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-slate-500"
    />
    <button
      type="submit"
      :disabled="props.loading"
      :class="[
        'shrink-0 rounded-xl bg-[#DEAC4B] px-8 py-4 text-lg font-bold text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
        props.loading ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110',
      ]"
    >
      {{ props.loading ? 'Processing...' : 'Shorten' }}
    </button>
  </form>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    loading?: boolean
  }>(),
  { loading: false }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

function handleSubmit(): void {
  emit('submit')
  if (props.modelValue.trim()) {
    console.log('Shorten requested:', props.modelValue.trim())
  }
}
</script>

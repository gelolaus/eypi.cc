<template>
  <form @submit.prevent="handleSubmit" novalidate class="mb-4 flex w-full flex-col gap-3 md:mb-8 md:flex-row">
    <input
      id="url"
      :value="props.modelValue"
      type="text"
      placeholder="Paste your long link here..."
      data-cursor="text"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="w-full rounded-2xl border-2 border-gray-300 bg-white px-7 py-5 text-xl text-slate-900 outline-none transition-colors placeholder-slate-400 focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-500"
    />
    <button
      type="submit"
      :disabled="props.loading"
      data-cursor="cta"
      :class="[
        'shrink-0 rounded-2xl bg-[#DEAC4B] px-10 py-5 text-xl font-bold text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
        props.loading ? 'opacity-70' : 'hover:brightness-110 hover:-translate-y-0.5',
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

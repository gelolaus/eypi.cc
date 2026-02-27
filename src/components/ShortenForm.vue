<template>
  <form @submit.prevent="handleSubmit" class="mb-8 flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
    <input
      id="url"
      :value="props.modelValue"
      type="url"
      placeholder="Paste your long link here..."
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="w-full rounded-xl border-2 border-gray-300 px-6 py-4 text-lg outline-none transition-colors focus:border-[#34418F]"
    />
    <button
      type="submit"
      class="shrink-0 rounded-xl bg-[#DEAC4B] px-8 py-4 text-lg font-bold text-white transition-all duration-200 hover:brightness-110"
    >
      Shorten
    </button>
  </form>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

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

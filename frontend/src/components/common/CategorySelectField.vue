<template>
  <div class="category-select-field">
    <label :for="id">{{ label }}<span v-if="required" aria-hidden="true"> *</span></label>
    <select :id="id" :value="selectedValue" :disabled="disabled" :required="required" @change="selectCategory">
      <option value="">Select a category</option>
      <option v-for="category in normalizedOptions" :key="category" :value="category">{{ category }}</option>
      <option :value="otherValue">Other</option>
    </select>
    <input
      v-if="selectedValue === otherValue"
      :id="`${id}-other`"
      :value="otherCategory"
      :disabled="disabled"
      :required="required"
      maxlength="120"
      autocomplete="off"
      placeholder="Type a category"
      :aria-label="`${label} - other category`"
      @input="updateOtherCategory"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const otherValue = '__other_category__'
const otherCategory = ref('')
const selectedOption = ref('')
const normalizedOptions = computed(() => [...new Set(props.options.map(option => String(option || '').trim()).filter(value => value && value.toLowerCase() !== 'other'))])
const findOption = value => normalizedOptions.value.find(option => option.toLowerCase() === String(value || '').trim().toLowerCase())
const selectedValue = computed(() => selectedOption.value || (findOption(props.modelValue) ? findOption(props.modelValue) : props.modelValue ? otherValue : ''))

watch(() => props.modelValue, value => {
  if (selectedOption.value === otherValue && (value === otherCategory.value || !value && !otherCategory.value)) return
  const option = findOption(value)
  if (option) {
    selectedOption.value = option
    otherCategory.value = ''
  } else if (value) {
    selectedOption.value = otherValue
    otherCategory.value = value
  } else {
    selectedOption.value = ''
    otherCategory.value = ''
  }
}, { immediate: true })

watch(normalizedOptions, () => {
  if (selectedOption.value !== otherValue) {
    const option = findOption(props.modelValue)
    selectedOption.value = option || ''
  }
})

const selectCategory = event => {
  const value = event.target.value
  if (value === otherValue) {
    selectedOption.value = otherValue
    otherCategory.value = ''
    emit('update:modelValue', '')
    return
  }
  selectedOption.value = value
  otherCategory.value = ''
  emit('update:modelValue', value)
}

const updateOtherCategory = event => {
  selectedOption.value = otherValue
  otherCategory.value = event.target.value
  emit('update:modelValue', event.target.value.trimStart())
}
</script>

<style scoped>
.category-select-field { display:flex; min-width:0; flex-direction:column; gap:.4rem; color:var(--ac-text-secondary, inherit); font-size:.875rem; font-weight:600; }
.category-select-field > label { display:block; }
.category-select-field > label span { color:var(--ac-danger, #ef4444); }
.category-select-field select,
.category-select-field input { width:100%; min-height:2.75rem; border:1px solid var(--ac-border-strong, #64748b); border-radius:.5rem; background:var(--ac-surface, #0f172a); padding:.65rem .8rem; color:var(--ac-text, #f8fafc); font:inherit; font-weight:400; }
.category-select-field select:focus,
.category-select-field input:focus { border-color:var(--ac-accent, #d97706); outline:2px solid color-mix(in srgb, var(--ac-accent, #d97706) 25%, transparent); outline-offset:1px; }
.category-select-field select:disabled,
.category-select-field input:disabled { cursor:not-allowed; opacity:.55; }
</style>

<script setup>
import { useId } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: String,
  icon: String,
  type: { type: String, default: 'text' },
  placeholder: String,
  autocomplete: String,
  inputmode: String,
  maxlength: [String, Number],
  error: String,
  format: Function, // optional: (value) => cleaned value, applied while typing
  size: { type: String, default: 'lg' }, // lg (forms) | sm
})
const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  let v = e.target.value
  if (props.format) {
    const cleaned = props.format(v)
    if (cleaned !== v) e.target.value = cleaned // keep the DOM in sync even if the model doesn't change
    v = cleaned
  }
  emit('update:modelValue', v)
}
const id = useId()
</script>

<template>
  <div class="field">
    <div v-if="label || $slots.hint" class="field__top">
      <label :for="id">{{ label }}</label>
      <slot name="hint" />
    </div>
    <div class="control" :class="[`control--${size}`, { 'control--error': error }]">
      <AppIcon v-if="icon" :name="icon" :size="16" class="control__icon" />
      <input
        :id="id" :value="modelValue" :type="type" :placeholder="placeholder" :autocomplete="autocomplete"
        :inputmode="inputmode" :maxlength="maxlength" :aria-invalid="!!error || undefined"
        @input="onInput"
      />
      <slot name="trailing" />
    </div>
    <p v-if="error" class="field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 6px; }
.field__top { display: flex; justify-content: space-between; align-items: center; }
label { font-size: 13px; font-weight: 600; color: var(--slate-800); }
.control { display: flex; align-items: center; gap: 10px; padding: 0 14px; background: rgba(239, 246, 255, .7);
  border: 1px solid var(--slate-200); border-radius: 16px; transition: border-color .15s, box-shadow .15s; }
.control--lg { height: 46px; }
.control--sm { height: 40px; border-radius: var(--radius-md); background: rgba(255, 255, 255, .85); }
.control:focus-within { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.control--error { border-color: #dc2626; background: var(--red-50); }
.control__icon { color: var(--slate-600); flex: none; }
input { flex: 1; min-width: 0; border: 0; background: none; outline: none; font-size: 14px; color: var(--slate-900); height: 100%; }
input::placeholder { color: var(--slate-400); }
.field__error { font-size: 12px; color: #dc2626; }
</style>

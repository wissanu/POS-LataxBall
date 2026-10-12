<script setup>
import { computed, reactive, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import { usePriceBoardStore } from '@/stores/priceBoard'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'
import { sanitizeDecimal, toNumber } from '@/utils/format'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const board = usePriceBoardStore()
const toast = useToast()

const prices = reactive({}) // { [gradeCode]: text }
const errors = reactive({})
const serverError = ref('')
const busy = ref(false)

const editing = computed(() => board.exists)
const priceOf = (code) => board.items.find((i) => i.grade === code)?.price

// every time the popup opens: start from today's current prices (blank when creating the day)
watch(() => props.modelValue, (open) => {
  if (!open) return
  serverError.value = ''
  for (const g of board.grades) {
    const p = priceOf(g.code)
    prices[g.code] = p != null ? String(p) : ''
    errors[g.code] = ''
  }
})

async function submit() {
  serverError.value = ''
  const payload = {}
  let ok = true
  for (const g of board.grades) {
    const raw = String(prices[g.code] ?? '').trim()
    // creating the day: every grade is required · editing: a blank grade stays as it is (or stays discarded)
    if (!raw && editing.value) { errors[g.code] = ''; continue }
    if (!(toNumber(raw) > 0)) { errors[g.code] = 'กรอกราคา (มากกว่า 0)'; ok = false; continue }
    errors[g.code] = ''
    payload[g.code] = toNumber(raw)
  }
  if (!ok) return
  if (!Object.keys(payload).length) return emit('update:modelValue', false)

  busy.value = true
  try {
    await board.save(payload)
    toast.success(editing.value ? 'บันทึกราคาของวันนี้แล้ว' : 'สร้างข้อมูลของวันนี้แล้ว')
    emit('update:modelValue', false)
  } catch (e) {
    serverError.value = getErrorMessage(e, 'บันทึกไม่สำเร็จ ลองอีกครั้ง')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue" :title="editing ? 'แก้ราคารับซื้อวันนี้' : 'ตั้งราคารับซื้อวันนี้'"
    :subtitle="`ประจำวันที่ ${formatThaiDate(board.date || board.yesterday.date)} · ราคาต่อกิโลกรัม แยกตามเกรด`" width="480px" @update:model-value="emit('update:modelValue', $event)"
  >
    <form id="price-board-form" class="form" novalidate @submit.prevent="submit">
      <BaseInput
        v-for="g in board.grades" :key="g.code" v-model="prices[g.code]" :label="g.name" icon="cash" placeholder="0.00" inputmode="decimal"
        autocomplete="off" size="sm" :format="sanitizeDecimal" :error="errors[g.code]"
      >
        <template #trailing><span class="unit">บาท / กก.</span></template>
      </BaseInput>
      <p v-if="editing" class="hint">ช่องที่เว้นว่างจะไม่ถูกเปลี่ยน (เกรดที่ discard ไว้จะกลับมาเมื่อกรอกราคา)</p>
      <p v-if="serverError" class="alert" role="alert">{{ serverError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="soft" size="lg" @click="emit('update:modelValue', false)">ยกเลิก</BaseButton>
      <BaseButton type="submit" form="price-board-form" size="lg" :loading="busy">{{ editing ? 'บันทึก' : 'สร้างข้อมูลวันนี้' }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.unit { font-size: 12px; font-weight: 500; color: var(--slate-500); white-space: nowrap; }
.hint { font-size: 12px; color: var(--slate-500); }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; line-height: 1.5; }
</style>

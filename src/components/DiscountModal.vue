<script setup>
import { reactive, ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import AppIcon from './AppIcon.vue'
import { useCartStore } from '@/stores/cart'
import { formatMoney, formatNumber, formatKg, sanitizeDecimal, toNumber, round2 } from '@/utils/format'

/**
 * เพิ่ม / แก้ไข ส่วนลด 1 รายการ — 3 ขั้นตอน:
 *   ① ใช้กับ  : ทุกตะกร้า หรือเฉพาะตะกร้าที่เลือก
 *   ② รูปแบบ  : ลดต่อ กก. (บาท/กก.)  หรือ  ลดเป็นเงิน (บาท)
 *   ③ จำนวน   : ช่องตัวเลขใหญ่ + ปุ่มลัด + ตัวอย่างผลลัพธ์ทันที
 */
const props = defineProps({ modelValue: Boolean, editId: { type: Number, default: null } })
const emit = defineEmits(['update:modelValue'])

const cart = useCartStore()
const form = reactive({ scope: 'all', mode: 'perKg', value: '' })
const error = ref('')

const QUICK = { perKg: [0.5, 1, 2, 3, 5], amount: [10, 20, 50, 100, 200] }
const MODES = [
  { v: 'perKg', title: 'ลดต่อ กก.', sub: 'ลดราคาตามน้ำหนัก (บาท/กก.)' },
  { v: 'amount', title: 'ลดเป็นเงิน', sub: 'หักเป็นจำนวนเงินคงที่ (บาท)' },
]

watch(() => props.modelValue, (open) => {
  if (!open) return
  error.value = ''
  const d = props.editId != null ? cart.discounts.find((x) => x.id === props.editId) : null
  form.scope = d ? d.scope : 'all'
  form.mode = d ? d.mode : 'perKg'
  form.value = d ? d.value : ''
})

const targets = computed(() => [
  { scope: 'all', title: 'ทุกตะกร้า', chip: null, sub: `น้ำหนักสุทธิรวม ${formatKg(cart.totalNet)} · ยอดรวม ${formatMoney(cart.subtotal)}` },
  ...cart.lines.map((l, i) => ({ scope: l.uid, title: `#${i + 1} ${l.name}`, chip: l.containerLabel, sub: `สุทธิ ${formatKg(cart.netOf(l))} · ${formatMoney(cart.amountOf(l))}` })),
])

const base = computed(() => {
  if (form.scope === 'all') return { net: cart.totalNet, amount: cart.subtotal, name: 'ทุกตะกร้า' }
  const l = cart.lines.find((x) => x.uid === form.scope)
  return l ? { net: cart.netOf(l), amount: cart.amountOf(l), name: 'ตะกร้านี้' } : { net: 0, amount: 0, name: '' }
})
const v = computed(() => toNumber(form.value))
const preview = computed(() => round2(form.mode === 'perKg' ? base.value.net * v.value : v.value))
const exceeds = computed(() => preview.value > base.value.amount)
const unit = computed(() => (form.mode === 'perKg' ? 'บาท/กก.' : 'บาท'))

function setMode(m) {
  if (form.mode === m) return
  form.mode = m
  form.value = '' // different unit → the old number would be misleading
}
function onValue(e) {
  form.value = sanitizeDecimal(e.target.value)
  e.target.value = form.value
}
function submit() {
  if (!(v.value > 0)) { error.value = 'กรุณากรอกจำนวนส่วนลด (มากกว่า 0)'; return }
  const payload = { scope: form.scope, mode: form.mode, value: form.value }
  if (props.editId != null) cart.updateDiscount(props.editId, payload)
  else cart.addDiscount(payload)
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal :model-value="modelValue" :title="editId != null ? 'แก้ไขส่วนลด' : 'เพิ่มส่วนลด'" subtitle="เพิ่มได้หลายรายการต่อลูกค้า 1 คน" width="540px" @update:model-value="emit('update:modelValue', $event)">
    <form id="discount-form" class="form" novalidate @submit.prevent="submit">
      <!-- ① -->
      <fieldset class="step">
        <legend><i>1</i> ใช้ส่วนลดกับ</legend>
        <div class="targets" role="radiogroup" aria-label="ใช้ส่วนลดกับ">
          <label v-for="t in targets" :key="String(t.scope)" class="target" :class="{ on: form.scope === t.scope }">
            <input v-model="form.scope" type="radio" name="scope" :value="t.scope" />
            <span class="target__dot" aria-hidden="true" />
            <span class="target__text">
              <b>{{ t.title }} <em v-if="t.chip">{{ t.chip }}</em></b>
              <small>{{ t.sub }}</small>
            </span>
          </label>
        </div>
      </fieldset>

      <!-- ② -->
      <fieldset class="step">
        <legend><i>2</i> รูปแบบส่วนลด</legend>
        <div class="modes" role="radiogroup" aria-label="รูปแบบส่วนลด">
          <button v-for="m in MODES" :key="m.v" type="button" role="radio" :aria-checked="form.mode === m.v" class="mode" :class="{ on: form.mode === m.v }" @click="setMode(m.v)">
            <b>{{ m.title }}</b><small>{{ m.sub }}</small>
          </button>
        </div>
      </fieldset>

      <!-- ③ -->
      <fieldset class="step">
        <legend><i>3</i> {{ form.mode === 'perKg' ? 'ลดกี่บาทต่อกิโลกรัม' : 'ลดเป็นจำนวนเงินเท่าไร' }}</legend>
        <label class="big">
          <span class="sr-only">{{ form.mode === 'perKg' ? 'ลดราคาต่อกิโลกรัม (บาท)' : 'จำนวนเงินที่ลด (บาท)' }}</span>
          <input data-autofocus :value="form.value" inputmode="decimal" placeholder="0.00" maxlength="9" autocomplete="off" @input="onValue" />
          <em>{{ unit }}</em>
        </label>
        <div class="quick" role="group" aria-label="ค่าที่ใช้บ่อย">
          <button v-for="q in QUICK[form.mode]" :key="q" type="button" :class="{ on: toNumber(form.value) === q }" @click="form.value = String(q)">{{ formatNumber(q).replace(/\.00$/, '') }}</button>
        </div>

        <div class="result" :class="{ 'result--warn': exceeds }" aria-live="polite">
          <template v-if="v > 0">
            <span class="result__amt">−{{ formatMoney(Math.min(preview, base.amount)) }}</span>
            <span class="result__why">
              <template v-if="form.mode === 'perKg'">{{ formatNumber(v) }} บาท × {{ formatKg(base.net) }}</template>
              <template v-else>หักจาก{{ base.name }} (ยอด {{ formatMoney(base.amount) }})</template>
            </span>
            <span v-if="exceeds" class="result__warn">เกินยอด ระบบจะหักสูงสุดเท่ายอดที่เลือก</span>
            <span v-else-if="form.mode === 'perKg' && base.net === 0" class="result__warn">ยังไม่ได้ใส่น้ำหนัก ยอดลดจะคำนวณเมื่อใส่น้ำหนักแล้ว</span>
          </template>
          <span v-else class="result__why">ใส่จำนวนเพื่อดูยอดส่วนลดทันที</span>
        </div>
        <p v-if="error" class="alert" role="alert">{{ error }}</p>
      </fieldset>
    </form>

    <template #footer>
      <BaseButton variant="soft" size="lg" @click="emit('update:modelValue', false)">ยกเลิก</BaseButton>
      <BaseButton type="submit" form="discount-form" size="lg"><AppIcon name="check" :size="16" /> {{ editId != null ? 'บันทึก' : 'เพิ่มส่วนลด' }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 20px; }
.step { border: 0; margin: 0; padding: 0; min-width: 0; }
.step legend { display: flex; align-items: center; gap: 8px; padding: 0; margin-bottom: 10px; font-size: 13px; font-weight: 700; line-height: 1.5; color: var(--slate-800); }
.step legend i { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--blue-600); color: #fff; font-style: normal; font-size: 11px; }

.targets { display: flex; flex-direction: column; gap: 6px; max-height: 188px; overflow-y: auto; padding: 2px; }
.target { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1.5px solid var(--slate-200); border-radius: 14px; background: #fff; cursor: pointer; transition: border-color .15s, background .15s; }
.target input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
.target:hover { border-color: #93c5fd; }
.target.on { border-color: var(--blue-600); background: var(--blue-50); }
.target:focus-within { outline: 2px solid var(--blue-600); outline-offset: 2px; }
.target__dot { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 2px solid var(--slate-300); background: #fff; transition: border .15s; }
.target.on .target__dot { border: 5px solid var(--blue-600); }
.target__text { display: flex; flex-direction: column; min-width: 0; }
.target__text b { font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--slate-900); overflow-wrap: anywhere; }
.target__text em { margin-left: 6px; font-style: normal; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 6px; background: var(--blue-100); color: var(--blue-700); }
.target__text small { font-size: 11px; line-height: 1.5; color: var(--slate-500); }

.modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mode { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; text-align: left; border: 1.5px solid var(--slate-200); border-radius: 14px; background: #fff; transition: border-color .15s, background .15s; }
.mode:hover { border-color: #93c5fd; }
.mode.on { border-color: var(--blue-600); background: var(--blue-50); }
.mode b { font-size: 14px; line-height: 1.5; color: var(--slate-900); }
.mode.on b { color: var(--blue-700); }
.mode small { font-size: 11px; line-height: 1.5; color: var(--slate-500); }

.big { position: relative; display: block; }
.big input { width: 100%; height: 64px; padding: 0 92px 0 18px; text-align: right; font-size: 30px; font-weight: 700; color: var(--slate-900); background: var(--slate-50); border: 1.5px solid var(--slate-200); border-radius: 18px; outline: none; }
.big input:focus { border-color: var(--blue-600); background: #fff; box-shadow: 0 0 0 4px rgba(37, 99, 235, .12); }
.big input::placeholder { color: var(--slate-300); }
.big em { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 14px; font-weight: 600; color: var(--slate-500); pointer-events: none; }
.quick { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.quick button { min-width: 52px; padding: 7px 14px; border-radius: 10px; background: var(--slate-100); color: var(--slate-700); font-size: 13px; font-weight: 600; transition: background .15s, color .15s; }
.quick button:hover { background: var(--blue-100); color: var(--blue-700); }
.quick button.on { background: var(--blue-600); color: #fff; }

.result { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; min-height: 52px; }
.result--warn { background: var(--amber-50); border-color: #fde68a; }
.result__amt { font-size: 20px; font-weight: 700; color: #dc2626; }
.result__why { font-size: 12px; line-height: 1.5; color: var(--slate-600); }
.result__warn { flex-basis: 100%; font-size: 11px; line-height: 1.5; color: var(--amber-700); }
.alert { margin-top: 10px; background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; }
@media (max-width: 520px) { .modes { grid-template-columns: 1fr; } .big input { font-size: 26px; } }
</style>

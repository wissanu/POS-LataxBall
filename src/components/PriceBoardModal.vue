<script setup>
// ตั้งราคารับซื้อประจำวัน: แยกตามประเภทสินค้า (ยางก้อนถ้วย / ขี้ฟอง) แล้วทำ 2 ขั้น
//   1) กำหนดช่วงราคา — แบบ "กำหนดช่วง" (เช่น 40 → 37 ทีละ 0.5 = 40, 39.5, … 37) หรือ "กำหนดเอง" (พิมพ์ราคาเองทีละค่า)
//   2) กำหนดเกรดจากช่วงราคา — แต่ละเกรดติ๊กเลือกราคาได้ "มากกว่า 1" ราคา (เช่น เกรด A = 39.5, 39, 38.5) · 1 ราคาอยู่ได้เพียงเกรดเดียว
//      ปุ่ม "จัดเกรดอัตโนมัติ" แบ่งช่วงราคาให้เกรดเรียงจากเกรดดี → ราคาสูง
import { computed, reactive, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
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

const MAX_STEPS = 80
const STEPS = ['0.25', '0.5', '1']
const types = computed(() => (board.productTypes.length ? board.productTypes : [{ code: 'CUP_LUMP', label: 'ยางก้อนถ้วย' }]))
const gradesOf = (t) => board.grades.filter((g) => (g.productType ?? 'CUP_LUMP') === t)
const shownTypes = computed(() => types.value.filter((t) => gradesOf(t.code).length))

const active = ref('CUP_LUMP')
const st = reactive({}) // st[type] = { mode: 'range' | 'manual', from, to, step, manual: number[], manualInput, sel: { [gradeCode]: number[] } }  (sel = ราคาที่เกรดนั้นเลือก เรียงมาก → น้อย)
const errors = reactive({})
const serverError = ref('')
const busy = ref(false)
const editing = computed(() => board.exists)
const pricesOf = (code) => board.items.filter((i) => i.grade === code).map((i) => i.price).sort((a, b) => b - a)
const money = (n) => Number(n).toFixed(2)

// ---- ช่วงราคา -> รายการราคา (มาก → น้อย) · คิดเป็นสตางค์กันเลขทศนิยมเพี้ยน ----
function ladderOf(t) {
  const s = st[t]
  if (!s) return []
  if (s.mode === 'manual') return [...new Set(s.manual.map((n) => Math.round(n * 100)))].sort((a, b) => b - a).map((c) => c / 100)
  const a = Math.round(toNumber(s.from) * 100); const b = Math.round(toNumber(s.to) * 100); const step = Math.round(toNumber(s.step) * 100)
  if (!(a > 0 && b > 0 && step > 0 && a >= b)) return []
  const out = []
  for (let c = a; c >= b && out.length <= MAX_STEPS; c -= step) out.push(c / 100)
  return out
}
const tooMany = (t) => st[t]?.mode === 'range' && ladderOf(t).length > MAX_STEPS
const ladder = (t) => ladderOf(t).slice(0, MAX_STEPS)
const rangeBad = (t) => {
  const s = st[t]
  if (s.mode !== 'range' || (!s.from && !s.to)) return ''
  if (!(toNumber(s.from) > 0) || !(toNumber(s.to) > 0)) return 'กรอกราคาสูงสุดและต่ำสุด'
  if (toNumber(s.from) < toNumber(s.to)) return 'ราคาสูงสุดต้องไม่น้อยกว่าราคาต่ำสุด'
  return ''
}

// ---- เปิดหน้าต่าง: เริ่มจากราคาปัจจุบันของวันนี้ (ถ้ามี) ----
watch(() => props.modelValue, (open) => {
  if (!open) return
  serverError.value = ''
  for (const t of types.value) {
    const gs = gradesOf(t.code)
    const sel = {}
    for (const g of gs) { sel[g.code] = pricesOf(g.code); errors[g.code] = '' }
    const existing = [...new Set(gs.flatMap((g) => sel[g.code]))].sort((a, b) => b - a)
    st[t.code] = { mode: existing.length ? 'manual' : 'range', from: '', to: '', step: '0.5', manual: existing, manualInput: '', sel }
  }
  active.value = shownTypes.value[0]?.code ?? 'CUP_LUMP'
})

// ช่วงราคาเปลี่ยน: ตัดราคาที่หลุดช่วงออก · ถ้ายังไม่ได้เลือกเกรดไหนเลย จัดเกรดให้อัตโนมัติ
watch(() => types.value.map((t) => ladderOf(t.code).join(',')), (now, was) => {
  types.value.forEach((t, i) => {
    if (now[i] === (was?.[i] ?? '') || !st[t.code]) return
    const L = ladderOf(t.code).slice(0, MAX_STEPS)
    const s = st[t.code]
    for (const g of gradesOf(t.code)) s.sel[g.code] = s.sel[g.code].filter((p) => L.includes(p))
    if (L.length && gradesOf(t.code).every((g) => !s.sel[g.code].length)) autoAssign(t.code)
  })
})

// แบ่งช่วงราคา (มาก → น้อย) ให้เกรดเรียงจากเกรดดี เป็นช่วงต่อเนื่อง: ราคามากกว่าเกรด → บางเกรดได้หลายราคา · ราคาน้อยกว่าเกรด → เกรดท้าย ๆ ไม่ได้ราคา
function autoAssign(t) {
  const L = ladder(t); const gs = gradesOf(t)
  if (!L.length) return
  gs.forEach((g, i) => {
    if (L.length >= gs.length) {
      const a = Math.floor((i * L.length) / gs.length); const b = Math.floor(((i + 1) * L.length) / gs.length)
      st[t].sel[g.code] = L.slice(a, b) // ราคาไม่น้อยกว่าเกรด: ทุกเกรดได้ช่วงต่อเนื่องอย่างน้อย 1 ราคา
    } else {
      st[t].sel[g.code] = i < L.length ? [L[i]] : [] // ราคาน้อยกว่าเกรด: เกรดท้าย ๆ ว่าง ให้ติ๊กเลือกเอง
    }
    errors[g.code] = ''
  })
}
// ติ๊ก/เลิกติ๊กราคาของเกรด — ราคาที่เกรดอื่นถือไว้จะถูกย้ายมาเกรดนี้
function toggle(t, code, price) {
  const s = st[t]
  if (s.sel[code].includes(price)) { s.sel[code] = s.sel[code].filter((p) => p !== price); return }
  for (const g of gradesOf(t)) if (g.code !== code) s.sel[g.code] = s.sel[g.code].filter((p) => p !== price)
  s.sel[code] = [...s.sel[code], price].sort((a, b) => b - a)
  errors[code] = ''
}
const ownerOf = (t, price) => gradesOf(t).find((g) => st[t].sel[g.code].includes(price))
const rangeText = (arr) => (!arr.length ? 'ยังไม่เลือกราคา' : arr.length === 1 ? `${money(arr[0])} บาท/กก.` : `${money(arr[0])} – ${money(arr[arr.length - 1])} บาท/กก. · ${arr.length} ราคา`)
function addManual(t) {
  const s = st[t]
  const n = toNumber(s.manualInput)
  if (!(n > 0)) return
  if (!s.manual.some((x) => Math.round(x * 100) === Math.round(n * 100)) && s.manual.length < MAX_STEPS) s.manual.push(Math.round(n * 100) / 100)
  s.manualInput = ''
}
const removeManual = (t, n) => { st[t].manual = st[t].manual.filter((x) => x !== n) }
const assigned = (t) => gradesOf(t).filter((g) => st[t]?.sel[g.code]?.length).length

async function submit() {
  serverError.value = ''
  const payload = {}
  let ok = true
  let firstBad = null
  for (const t of types.value) {
    for (const g of gradesOf(t.code)) {
      const picked = st[t.code]?.sel[g.code] ?? []
      // สร้างข้อมูลของวัน: ทุกเกรดต้องมีอย่างน้อย 1 ราคา · แก้ไข: เกรดที่ไม่ได้เลือกราคาเลยจะคงของเดิม (หรือคงสถานะ discard)
      if (!picked.length && editing.value) { errors[g.code] = ''; continue }
      if (!picked.length) { errors[g.code] = 'เลือกอย่างน้อย 1 ราคา'; ok = false; firstBad ??= t.code; continue }
      errors[g.code] = ''
      payload[g.code] = picked // เกรดนี้มีหลายราคาได้ — ส่งเป็นรายการ
    }
  }
  if (!ok) { active.value = firstBad; return }
  if (!Object.keys(payload).length) return emit('update:modelValue', false)

  busy.value = true
  try {
    await board.save(payload)
    toast.success(editing.value ? `บันทึกราคา${board.isBackdated ? `ของวันที่ ${formatThaiDate(board.date)}` : 'ของวันนี้'}แล้ว` : `สร้างข้อมูล${board.isBackdated ? `ของวันที่ ${formatThaiDate(board.date)}` : 'ของวันนี้'}แล้ว`)
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
    :model-value="modelValue" :title="editing ? `แก้ราคารับซื้อ${board.isBackdated ? 'ย้อนหลัง' : 'วันนี้'}` : `ตั้งราคารับซื้อ${board.isBackdated ? 'ย้อนหลัง' : 'วันนี้'}`"
    :subtitle="`ประจำวันที่ ${formatThaiDate(board.date)} · ราคาต่อกิโลกรัม แยกตามประเภทสินค้า`" width="580px" @update:model-value="emit('update:modelValue', $event)"
  >
    <form id="price-board-form" class="form" novalidate @submit.prevent="submit">
      <!-- ประเภทสินค้า -->
      <div class="tabs" role="tablist" aria-label="ประเภทสินค้า">
        <button v-for="t in shownTypes" :key="t.code" type="button" role="tab" :aria-selected="active === t.code" :class="{ on: active === t.code }" @click="active = t.code">
          ราคา{{ t.label }} <small>{{ assigned(t.code) }}/{{ gradesOf(t.code).length }} เกรด</small>
        </button>
      </div>

      <template v-for="t in shownTypes" :key="t.code">
        <section v-if="st[t.code]" v-show="active === t.code" class="sec">
          <h3><span class="tag">{{ t.label }}</span> กำหนดราคา{{ t.label }}</h3>

          <!-- ขั้น 1: ช่วงราคา -->
          <div class="step">
            <p class="step__h"><b>1</b> กำหนดช่วงราคา</p>
            <div class="seg" role="radiogroup" :aria-label="`วิธีกำหนดราคา${t.label}`">
              <button type="button" role="radio" :aria-checked="st[t.code].mode === 'range'" :class="{ on: st[t.code].mode === 'range' }" @click="st[t.code].mode = 'range'">กำหนดช่วง</button>
              <button type="button" role="radio" :aria-checked="st[t.code].mode === 'manual'" :class="{ on: st[t.code].mode === 'manual' }" @click="st[t.code].mode = 'manual'">กำหนดราคาเอง</button>
            </div>

            <div v-if="st[t.code].mode === 'range'" class="rng">
              <label><span>ราคาสูงสุด</span><input v-model="st[t.code].from" inputmode="decimal" placeholder="40" autocomplete="off" @input="st[t.code].from = sanitizeDecimal($event.target.value, 2)" /></label>
              <i aria-hidden="true">→</i>
              <label><span>ราคาต่ำสุด</span><input v-model="st[t.code].to" inputmode="decimal" placeholder="37" autocomplete="off" @input="st[t.code].to = sanitizeDecimal($event.target.value, 2)" /></label>
              <label><span>ทีละ</span>
                <select v-model="st[t.code].step"><option v-for="s in STEPS" :key="s" :value="s">{{ s }} บาท</option></select>
              </label>
            </div>
            <div v-else class="man">
              <input v-model="st[t.code].manualInput" inputmode="decimal" placeholder="พิมพ์ราคา เช่น 39.5 แล้วกด Enter" autocomplete="off" @input="st[t.code].manualInput = sanitizeDecimal($event.target.value, 2)" @keydown.enter.prevent="addManual(t.code)" />
              <BaseButton type="button" variant="soft" size="sm" @click="addManual(t.code)">เพิ่มราคา</BaseButton>
            </div>
            <p v-if="rangeBad(t.code)" class="err">{{ rangeBad(t.code) }}</p>
            <p v-else-if="tooMany(t.code)" class="err">ช่วงราคานี้มีมากกว่า {{ MAX_STEPS }} ระดับ — เพิ่มค่า “ทีละ” หรือลดช่วงลง</p>

            <div class="chips" aria-live="polite">
              <template v-if="ladder(t.code).length">
                <span v-for="p in ladder(t.code)" :key="p" class="chip">{{ money(p) }}<button v-if="st[t.code].mode === 'manual'" type="button" :aria-label="`ลบราคา ${money(p)}`" @click="removeManual(t.code, p)">×</button></span>
                <small>{{ ladder(t.code).length }} ระดับ</small>
              </template>
              <small v-else class="muted">{{ st[t.code].mode === 'range' ? 'กรอกราคาสูงสุด–ต่ำสุด แล้วระบบจะแบ่งช่วงให้ (เช่น 40 → 37 ทีละ 0.5 ได้ 40, 39.5, 39 … 37)' : 'ยังไม่มีราคา — พิมพ์ราคาแล้วกด Enter' }}</small>
            </div>
          </div>

          <!-- ขั้น 2: เกรดจากช่วงราคา -->
          <div class="step">
            <p class="step__h"><b>2</b> กำหนดเกรดจากช่วงราคา
              <button type="button" class="auto" :disabled="!ladder(t.code).length" @click="autoAssign(t.code)">จัดเกรดอัตโนมัติ</button>
            </p>
            <p class="muted">ติ๊กเลือกราคาให้แต่ละเกรดได้ <b>มากกว่า 1 ราคา</b> (เช่น เกรด A = 39.5, 39, 38.5) · 1 ราคาอยู่ได้เพียงเกรดเดียว — ติ๊กราคาที่เกรดอื่นถืออยู่ ราคานั้นจะย้ายมาเกรดนี้</p>
            <ul class="grades">
              <li v-for="g in gradesOf(t.code)" :key="g.code" :class="{ bad: errors[g.code] }">
                <div class="g__head"><b>{{ g.name }}</b><span :class="{ none: !st[t.code].sel[g.code].length }">{{ rangeText(st[t.code].sel[g.code]) }}</span></div>
                <div class="g__chips" role="group" :aria-label="`ราคาของ${g.name}`">
                  <button
                    v-for="p in ladder(t.code)" :key="p" type="button" class="pc"
                    :class="{ on: st[t.code].sel[g.code].includes(p), taken: ownerOf(t.code, p) && ownerOf(t.code, p).code !== g.code }"
                    :aria-pressed="st[t.code].sel[g.code].includes(p)" @click="toggle(t.code, g.code, p)"
                  >{{ money(p) }}<small v-if="ownerOf(t.code, p) && ownerOf(t.code, p).code !== g.code">{{ ownerOf(t.code, p).code }}</small></button>
                  <small v-if="!ladder(t.code).length" class="muted">กำหนดช่วงราคาในขั้น 1 ก่อน</small>
                </div>
                <em v-if="errors[g.code]">{{ errors[g.code] }}</em>
              </li>
            </ul>
          </div>
        </section>
      </template>

      <p v-if="editing" class="hint">เกรดที่ไม่ได้เลือกราคาเลยจะคงราคาเดิม · เกรดที่ติ๊กออกบางราคา ราคานั้นจะถูกเอาออกจาก{{ board.isBackdated ? 'วันนี้ที่เลือก' : 'วันนี้' }} (เกรดที่ discard ไว้จะกลับมาเมื่อเลือกราคา)</p>
      <p v-if="serverError" class="alert" role="alert">{{ serverError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="soft" size="lg" @click="emit('update:modelValue', false)">ยกเลิก</BaseButton>
      <BaseButton type="submit" form="price-board-form" size="lg" :loading="busy">{{ editing ? 'บันทึก' : board.isBackdated ? 'สร้างข้อมูลวันนั้น' : 'สร้างข้อมูลวันนี้' }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.tabs { display: flex; gap: 6px; padding: 4px; border-radius: var(--radius-md); background: var(--slate-100); }
.tabs button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 9px 10px; border-radius: 10px; font-size: 13px; font-weight: 700; color: var(--slate-500); }
.tabs button small { font-size: 10px; font-weight: 500; color: var(--slate-400); }
.tabs button.on { background: #fff; color: var(--blue-700); box-shadow: 0 1px 3px rgba(0, 0, 0, .1); }
.tabs button.on small { color: var(--slate-500); }
.sec { display: flex; flex-direction: column; gap: 12px; }
.sec h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; color: var(--slate-900); }
.tag { padding: 2px 10px; border-radius: 9999px; background: var(--blue-50); border: 1px solid var(--blue-100); color: var(--blue-700); font-size: 11px; font-weight: 700; }
.step { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); }
.step__h { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--slate-700); }
.step__h b { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--blue-600); color: #fff; font-size: 11px; }
.auto { margin-left: auto; padding: 4px 10px; border-radius: 9999px; border: 1px solid var(--blue-100); background: #fff; color: var(--blue-700); font-size: 11px; font-weight: 700; }
.auto:disabled { opacity: .45; cursor: not-allowed; }
.seg { display: inline-flex; gap: 2px; padding: 3px; width: fit-content; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; }
.seg button { padding: 6px 14px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); }
.seg button.on { background: var(--blue-50); color: var(--blue-700); font-weight: 700; }
.rng { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 10px; }
.rng i { font-style: normal; color: var(--slate-400); padding-bottom: 8px; }
.rng label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--slate-500); }
.rng input, .rng select, .man input, .grades select { height: 36px; padding: 0 10px; border: 1px solid var(--slate-300); border-radius: 10px; font: inherit; font-size: 13px; font-weight: 600; color: var(--slate-900); background: #fff; outline: none; }
.rng input { width: 110px; text-align: right; }
.rng input:focus, .man input:focus, .grades select:focus, .rng select:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.man { display: flex; gap: 8px; } .man input { flex: 1; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 9999px; background: #fff; border: 1px solid var(--blue-100); color: var(--blue-700); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.chip button { color: var(--slate-400); font-size: 14px; line-height: 1; } .chip button:hover { color: #dc2626; }
.chips small, .muted { font-size: 11px; line-height: 1.6; color: var(--slate-500); }
.grades { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.grades li { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 10px; background: #fff; border: 1px solid var(--slate-100); }
.grades li.bad { border-color: #fca5a5; background: var(--red-50); }
.g__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.g__head b { font-size: 13px; color: var(--slate-800); }
.g__head span { font-size: 11px; font-weight: 600; color: var(--blue-700); font-variant-numeric: tabular-nums; } .g__head span.none { color: var(--slate-400); font-weight: 500; }
.g__chips { display: flex; flex-wrap: wrap; gap: 5px; }
.pc { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 9999px; border: 1px solid var(--slate-200); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-600); font-variant-numeric: tabular-nums; }
.pc:hover { border-color: var(--blue-600); }
.pc.on { background: var(--blue-600); border-color: var(--blue-600); color: #fff; font-weight: 700; }
.pc.taken { background: var(--slate-100); color: var(--slate-400); border-style: dashed; }
.pc small { font-size: 10px; font-weight: 700; color: var(--slate-500); }
.grades em { font-style: normal; font-size: 11px; color: #dc2626; }
.err { font-size: 11px; color: #dc2626; }
.hint { font-size: 12px; color: var(--slate-500); }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; line-height: 1.5; }
</style>

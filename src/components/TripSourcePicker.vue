<script setup>
// เลือกยางที่จะขายให้โรงงานในเที่ยวนี้ จาก "ยางรอขาย" (ใบรับซื้อที่ยืนยันแล้วและยังไม่ได้ขาย)
//   แท็บ "ยางก้อนถ้วย" เห็นและนับเฉพาะยางก้อนถ้วย · แท็บ "ขี้ฟอง" เห็นและนับเฉพาะขี้ฟอง — ไม่ปนกัน
//   ลูกค้า 1 คนชั่งทั้งยางก้อนถ้วยและขี้ฟองในใบเดียวกันได้ ระบบแยกให้อัตโนมัติจากเกรดของแต่ละรายการ (ใบเดียวโผล่ได้ทั้งสองแท็บ ตามน้ำหนักของประเภทนั้น)
//   ขายต่อวัน : ใบสถานะ "ขายต่อวัน" (ติ๊กไว้ให้อัตโนมัติสำหรับวันที่ของเที่ยวนี้)
//   ยางค้างคืน: ใบสถานะ "ค้างคืน" — เลือกได้หลายวัน (ติ๊กทั้งวัน หรือกางดูแล้วเลือกเป็นใบ)
// ใบที่อยู่ในฉบับร่างเที่ยวอื่น ("กำลังจัดส่ง") เลือกซ้ำไม่ได้ จนกว่าจะลบฉบับร่างนั้น
// ผลลัพธ์: modelValue = { ids: [purchaseId], includeFoam: false } — ฉบับร่างล็อกเฉพาะใบที่เลือกไว้ (ใบที่รับซื้อเพิ่มทีหลังไม่ถูกบวกเข้ามาเอง) · emit total ({ kg, ... }) ทุกครั้งที่น้ำหนักรวมเปลี่ยน · emit ready เมื่อโหลดรายการเสร็จ
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { stockService } from '@/services/stockService'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'
import { formatNumber } from '@/utils/format'

const props = defineProps({
  modelValue: { type: Object, required: true },
  productType: { type: String, default: 'CUP_LUMP' },
  tripId: { type: String, default: null },
  tripDate: { type: String, default: '' },
  draftId: { type: String, default: null }, // ฉบับร่างที่กำลังเปิดอยู่ (ใบที่ฉบับร่างนี้จองไว้ = ของตัวเอง ไม่ล็อก)
})
const emit = defineEmits(['update:modelValue', 'total', 'ready'])

const data = ref(null)
const loading = ref(false)
const error = ref('')
const open = reactive({}) // กางดูใบของวันนั้น: `${hold}:${date}`
let touched = false

const isFoam = computed(() => props.productType === 'FOAM')
const typeName = computed(() => (isFoam.value ? 'ขี้ฟอง' : 'ยางก้อนถ้วย'))
const sel = computed(() => new Set(props.modelValue.ids))
// น้ำหนักของ "ประเภทนี้" เท่านั้น
const kgOf = (b) => (isFoam.value ? b.foamKg : b.cupKg)
const boughtOf = (b) => (isFoam.value ? b.foamBought : b.cupBought)
const usable = (b) => kgOf(b) > 0.004
const lockOf = (b) => (isFoam.value ? b.foamLock : b.cupLock) // id ฉบับร่างอื่นที่จองไว้ · null = เลือกได้
const free = (b) => usable(b) && !lockOf(b)
const partial = (b) => boughtOf(b) > 0 && kgOf(b) < boughtOf(b) - 0.004

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await stockService.unsold(props.tripId, props.draftId)
    if (!props.tripId && !touched && !props.modelValue.ids.length && props.tripDate) preselectSameDay() // เที่ยวใหม่: ติ๊กยางขายต่อวันของวันที่ขนส่งให้
    emit('ready', totals.value)
  } catch (e) {
    error.value = getErrorMessage(e, 'โหลดยางรอขายไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.tripId, load)

// เฉพาะใบที่มียางประเภทนี้เหลืออยู่ (ใบที่ไม่มี ไม่แสดงเลย)
const allBills = computed(() => (data.value?.days ?? []).flatMap((d) => d.bills).filter(free)) // เลือกได้ (ไม่ถูกล็อก)
const lockedCount = computed(() => (data.value?.days ?? []).flatMap((d) => d.bills).filter((b) => usable(b) && lockOf(b)).length)
const groups = computed(() => ['SAME_DAY', 'OVERNIGHT'].map((hold) => {
  const days = (data.value?.days ?? []).map((d) => ({ date: d.date, bills: d.bills.filter((b) => b.hold === hold && usable(b)) })).filter((d) => d.bills.length)
  const bills = days.flatMap((d) => d.bills).filter(free)
  return { hold, label: hold === 'SAME_DAY' ? 'ขายต่อวัน' : 'ยางค้างคืน', days, kg: bills.reduce((a, b) => a + kgOf(b), 0), count: days.flatMap((d) => d.bills).length, locked: days.flatMap((d) => d.bills).length - bills.length }
}))
const dayKg = (d) => d.bills.filter(free).reduce((a, b) => a + kgOf(b), 0)
const dayLocked = (d) => d.bills.filter((b) => lockOf(b)).length

function emitIds(ids) { touched = true; emit('update:modelValue', { ...props.modelValue, includeFoam: false, ids: [...ids] }) }
function toggleBill(b) {
  const next = new Set(sel.value)
  next.has(b.id) ? next.delete(b.id) : next.add(b.id)
  emitIds(next)
}
const dayState = (day) => {
  const fr = day.bills.filter(free)
  const n = fr.filter((b) => sel.value.has(b.id)).length
  return { all: fr.length > 0 && n === fr.length, some: n > 0 && n < fr.length, none: fr.length === 0 }
}
function toggleDay(day) {
  const next = new Set(sel.value)
  const st = dayState(day)
  for (const b of day.bills.filter(free)) st.all ? next.delete(b.id) : next.add(b.id)
  emitIds(next)
}
function toggleGroup(g, on) {
  const next = new Set(sel.value)
  for (const d of g.days) for (const b of d.bills.filter(free)) on ? next.add(b.id) : next.delete(b.id)
  emitIds(next)
}
function preselectSameDay() {
  const ids = allBills.value.filter((b) => b.hold === 'SAME_DAY' && b.date === props.tripDate).map((b) => b.id)
  if (ids.length) emit('update:modelValue', { ...props.modelValue, includeFoam: false, ids })
}

// เปลี่ยนประเภทสินค้าของเที่ยว → ตัดใบที่ไม่มียางประเภทนี้ออกจากที่เลือก
watch(() => props.productType, () => {
  if (!data.value) return
  const keep = props.modelValue.ids.filter((id) => allBills.value.some((x) => x.id === id))
  if (keep.length !== props.modelValue.ids.length) emit('update:modelValue', { ...props.modelValue, ids: keep })
})

const picked = computed(() => allBills.value.filter((b) => sel.value.has(b.id)))
const totals = computed(() => {
  const kg = Math.round(picked.value.reduce((a, b) => a + kgOf(b), 0) * 100) / 100
  const days = [...new Set(picked.value.map((b) => b.date))].sort()
  return { bills: picked.value.length, kg, cupKg: isFoam.value ? 0 : kg, foamKg: isFoam.value ? kg : 0, days }
})
const missing = computed(() => props.modelValue.ids.filter((id) => data.value && !allBills.value.some((b) => b.id === id)).length)
watch(totals, (t) => emit('total', t), { immediate: true })

const dayShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const shortDate = (s) => dayShort.format(new Date(`${s}T00:00:00`))
</script>

<template>
  <section class="tsp" :aria-label="`${typeName}ที่ขายในเที่ยวนี้`">
    <div class="tsp__head">
      <h3>{{ typeName }}ที่ขายในเที่ยวนี้ <small>เลือกจากยางรอขาย · ผูกกับวันที่ซื้อ เพื่อทำบิลอ้างอิงราคาของวันนั้น</small></h3>
    </div>

    <p v-if="error" class="tsp__err" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>
    <p v-else-if="loading && !data" class="tsp__empty">กำลังโหลดยางรอขาย…</p>
    <p v-else-if="data && !allBills.length && !lockedCount" class="tsp__empty">ไม่มี{{ typeName }}รอขาย — ยังไม่มีใบรับซื้อที่ยืนยันแล้วและยังไม่ได้ขาย (ยังบันทึกเที่ยวโดยกรอกน้ำหนักเองได้)</p>

    <template v-else-if="data">
      <p v-if="!allBills.length" class="tsp__empty">{{ typeName }}ที่เหลือทั้งหมด ({{ lockedCount }} ใบ) กำลังจัดส่งอยู่ในฉบับร่างอื่น — ลบฉบับร่างนั้นก่อนหากต้องการเลือกใหม่</p>
      <div v-for="g in groups" v-show="g.count" :key="g.hold" class="grp" :class="{ 'grp--night': g.hold === 'OVERNIGHT' }">
        <div class="grp__head">
          <b>{{ g.label }}</b>
          <span>{{ g.count }} ใบ · {{ typeName }} {{ formatNumber(g.kg) }} กก.<template v-if="g.locked"> · <b class="lk">กำลังจัดส่ง {{ g.locked }} ใบ</b></template></span>
          <span class="grp__act"><button type="button" @click="toggleGroup(g, true)">เลือกทั้งหมด</button><button type="button" @click="toggleGroup(g, false)">ล้าง</button></span>
        </div>
        <ul class="days">
          <li v-for="d in g.days" :key="d.date" class="day">
            <div class="day__row">
              <input type="checkbox" :checked="dayState(d).all" :indeterminate.prop="dayState(d).some" :disabled="dayState(d).none" :aria-label="`เลือก${typeName}ที่ซื้อวันที่ ${formatThaiDate(d.date)} ทั้งวัน`" @change="toggleDay(d)" />
              <button type="button" class="day__name" :aria-expanded="!!open[g.hold + ':' + d.date]" @click="open[g.hold + ':' + d.date] = !open[g.hold + ':' + d.date]">
                <span class="chev" :class="{ up: open[g.hold + ':' + d.date] }">▸</span> ซื้อวันที่ <b>{{ formatThaiDate(d.date) }}</b> <i>{{ d.bills.length }} ใบ</i>
              </button>
              <span class="day__kg">{{ typeName }}ทั้งวัน <b>{{ formatNumber(dayKg(d)) }}</b> กก.<template v-if="dayLocked(d)"> · <b class="lk">กำลังจัดส่ง {{ dayLocked(d) }} ใบ</b></template></span>
            </div>
            <ul v-if="open[g.hold + ':' + d.date]" class="bills">
              <li v-for="b in d.bills" :key="b.id" :class="{ 'is-locked': lockOf(b) }">
                <input type="checkbox" :checked="sel.has(b.id)" :disabled="!!lockOf(b)" :aria-label="`เลือกใบ ${b.no}`" @change="toggleBill(b)" />
                <span class="b__no">{{ b.no }} <small>{{ b.time }} · {{ b.customer }}</small></span>
                <span class="b__kg">{{ formatNumber(kgOf(b)) }} กก.</span>
                <span v-if="lockOf(b)" class="b__lock" title="อยู่ในฉบับร่างเที่ยวขนส่งอื่น — ลบฉบับร่างนั้นก่อนจึงจะเลือกซ้ำได้">กำลังจัดส่ง (อยู่ในฉบับร่าง)</span>
                <span v-else-if="partial(b)" class="b__tag">ขายบางส่วนแล้ว</span>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>

    <p v-if="missing" class="tsp__err">มี {{ missing }} ใบที่เลือกไว้แต่ไม่อยู่ในรายการรอขายแล้ว (ขายไปแล้วหรือถูกยกเลิก) — ล้างหรือเลือกใหม่ก่อนบันทึก</p>

    <div class="tsp__sum" :class="{ on: totals.bills }" role="status">
      <template v-if="totals.bills">
        เลือก <b>{{ totals.bills }}</b> ใบ ({{ totals.days.map(shortDate).join(', ') }})
        <span class="tsp__tot">{{ typeName }}รวม {{ formatNumber(totals.kg) }} กก.</span>
      </template>
      <template v-else>ยังไม่ได้เลือกยาง — เที่ยวนี้จะไม่ผูกกับใบรับซื้อ (ต้นทุนคิดแบบเข้าก่อนออกก่อน)</template>
    </div>
  </section>
</template>

<style scoped>
.tsp { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); }
.tsp__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.tsp__head h3 { font-size: 13px; font-weight: 800; color: var(--blue-700); } .tsp__head h3 small { display: block; font-size: 11px; font-weight: 500; color: var(--slate-500); }
.tsp__empty { font-size: 12px; color: var(--slate-500); } .tsp__err { font-size: 12px; color: #dc2626; } .tsp__err button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.grp { border: 1px solid var(--slate-100); border-left: 4px solid #2563eb; border-radius: 10px; background: #fff; overflow: hidden; } .grp--night { border-left-color: #7c3aed; }
.grp__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 12px; background: var(--blue-50); font-size: 12px; color: var(--slate-600); } .grp--night .grp__head { background: #f5f3ff; }
.grp__head b { font-size: 13px; color: var(--slate-800); } .grp__act { margin-left: auto; display: inline-flex; gap: 10px; } .grp__act button { font-size: 11px; font-weight: 700; color: var(--blue-700); }
.days, .bills { list-style: none; margin: 0; padding: 0; }
.day { border-top: 1px solid var(--slate-100); }
.day__row { display: flex; align-items: center; gap: 10px; padding: 6px 12px; font-size: 12px; }
.day__name { display: inline-flex; align-items: center; gap: 6px; color: var(--slate-700); text-align: left; } .day__name i { font-style: normal; color: var(--slate-400); }
.day__kg { margin-left: auto; color: var(--slate-600); font-variant-numeric: tabular-nums; }
.chev { display: inline-block; font-size: 10px; transition: transform .15s; } .chev.up { transform: rotate(90deg); }
.bills { padding: 0 12px 6px 38px; display: flex; flex-direction: column; gap: 2px; }
.bills li { display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 8px; font-size: 11px; background: var(--slate-50); } .bills li.off { opacity: .55; }
.b__no { font-weight: 700; color: var(--slate-800); } .b__no small { font-weight: 500; color: var(--slate-400); margin-left: 6px; }
.b__kg { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--slate-700); } .b__kg em { font-style: normal; color: var(--amber-700); }
.b__tag { padding: 1px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: #f0fdf4; color: #15803d; border: 1px solid #86efac; } .b__tag--warn { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; }
.tsp__sum { padding: 8px 12px; border-radius: 10px; background: #fff; border: 1px dashed var(--slate-300); font-size: 12px; color: var(--slate-500); } .tsp__sum.on { border-style: solid; border-color: var(--blue-100); background: var(--blue-50); color: var(--slate-700); }
.tsp__sum b { color: var(--slate-900); } .tsp__tot { margin-left: 8px; font-size: 14px; font-weight: 800; color: var(--blue-700); }
.lk { color: var(--blue-700); font-weight: 800; }
.is-locked { opacity: .65; }
.b__lock { padding: 1px 8px; border-radius: 9999px; font-size: 10.5px; font-weight: 700; background: var(--blue-50); color: var(--blue-700); border: 1px solid #93c5fd; white-space: nowrap; }
</style>

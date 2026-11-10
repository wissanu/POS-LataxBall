<script setup>
// เลือกยางที่จะขายให้โรงงานในเที่ยวนี้ จาก "ยางรอขาย" (ใบรับซื้อที่ยังไม่ได้ขาย)
//   • ขายต่อวัน : ใบสถานะ "ขายต่อวัน" ที่ยังไม่ได้ขาย (ติ๊กไว้ให้อัตโนมัติสำหรับวันที่ของเที่ยวนี้)
//   • ยางค้างคืน: ใบสถานะ "ค้างคืน" — เลือกได้หลายวัน (ติ๊กทั้งวัน หรือกางดูแล้วเลือกเป็นใบ) แสดงน้ำหนักรวมให้ทันที
//   • นับขี้ฟอง / ไม่นับขี้ฟอง : ติ๊กเพื่อให้ขี้ฟองของใบที่เลือกไปกับเที่ยวนี้ด้วย (ไม่ติ๊ก = ขี้ฟองยังค้างรอขายต่อ)
// ผลลัพธ์: modelValue = { ids: [purchaseId], includeFoam } · emit total เมื่อน้ำหนักรวมเปลี่ยน (ให้ฟอร์มเติม "น้ำหนักที่ส่ง")
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { stockService } from '@/services/stockService'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'
import { formatMoney, formatNumber } from '@/utils/format'

const props = defineProps({
  modelValue: { type: Object, required: true },
  productType: { type: String, default: 'CUP_LUMP' },
  tripId: { type: String, default: null },
  tripDate: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'total'])

const data = ref(null)
const loading = ref(false)
const error = ref('')
const open = reactive({}) // กางดูใบของวันนั้น: `${hold}:${date}`
let touched = false

const isFoamTrip = computed(() => props.productType === 'FOAM')
const includeFoam = computed(() => !isFoamTrip.value && props.modelValue.includeFoam)
const sel = computed(() => new Set(props.modelValue.ids))
const kgOf = (b) => (isFoamTrip.value ? b.foamKg : b.cupKg + (includeFoam.value ? b.foamKg : 0))
const usable = (b) => kgOf(b) > 0.004

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await stockService.unsold(props.tripId)
    if (!props.tripId && !touched && !props.modelValue.ids.length && props.tripDate) preselectSameDay() // เที่ยวใหม่: ติ๊กยางขายต่อวันของวันที่ขนส่งให้
  } catch (e) {
    error.value = getErrorMessage(e, 'โหลดยางรอขายไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.tripId, load)

const allBills = computed(() => (data.value?.days ?? []).flatMap((d) => d.bills))
const groups = computed(() => ['SAME_DAY', 'OVERNIGHT'].map((hold) => {
  const days = (data.value?.days ?? []).map((d) => ({ date: d.date, bills: d.bills.filter((b) => b.hold === hold) })).filter((d) => d.bills.length)
  const bills = days.flatMap((d) => d.bills)
  return {
    hold, label: hold === 'SAME_DAY' ? 'ขายต่อวัน' : 'ยางค้างคืน', days,
    cup: bills.reduce((a, b) => a + b.cupKg, 0), foam: bills.reduce((a, b) => a + b.foamKg, 0), count: bills.length,
  }
}))

function emitIds(ids) { touched = true; emit('update:modelValue', { ...props.modelValue, ids: [...ids] }) }
function toggleBill(b) {
  if (!usable(b)) return
  const next = new Set(sel.value)
  next.has(b.id) ? next.delete(b.id) : next.add(b.id)
  emitIds(next)
}
const dayState = (day) => {
  const u = day.bills.filter(usable); const n = u.filter((b) => sel.value.has(b.id)).length
  return { all: u.length > 0 && n === u.length, some: n > 0 && n < u.length, none: u.length === 0 }
}
function toggleDay(day) {
  const next = new Set(sel.value)
  const st = dayState(day)
  for (const b of day.bills.filter(usable)) st.all ? next.delete(b.id) : next.add(b.id)
  emitIds(next)
}
function toggleGroup(g, on) {
  const next = new Set(sel.value)
  for (const d of g.days) for (const b of d.bills.filter(usable)) on ? next.add(b.id) : next.delete(b.id)
  emitIds(next)
}
function preselectSameDay() {
  const ids = allBills.value.filter((b) => b.hold === 'SAME_DAY' && b.date === props.tripDate && usable(b)).map((b) => b.id)
  if (ids.length) emit('update:modelValue', { ...props.modelValue, ids })
}
const setFoam = (v) => { touched = true; emit('update:modelValue', { ...props.modelValue, includeFoam: v }) }

// เปลี่ยนประเภทสินค้าของเที่ยว / เลือกนับขี้ฟอง → ตัดใบที่ไม่มียางให้ขายออกจากที่เลือก
watch([() => props.productType, includeFoam], () => {
  const keep = props.modelValue.ids.filter((id) => { const b = allBills.value.find((x) => x.id === id); return b && usable(b) })
  if (keep.length !== props.modelValue.ids.length) emit('update:modelValue', { ...props.modelValue, ids: keep })
})

const picked = computed(() => allBills.value.filter((b) => sel.value.has(b.id) && usable(b)))
const totals = computed(() => {
  const cup = isFoamTrip.value ? 0 : picked.value.reduce((a, b) => a + b.cupKg, 0)
  const foam = isFoamTrip.value || includeFoam.value ? picked.value.reduce((a, b) => a + b.foamKg, 0) : 0
  const days = [...new Set(picked.value.map((b) => b.date))].sort()
  return { bills: picked.value.length, cupKg: cup, foamKg: foam, kg: cup + foam, days }
})
const missing = computed(() => props.modelValue.ids.filter((id) => data.value && !allBills.value.some((b) => b.id === id)).length)
watch(totals, (t) => emit('total', t), { immediate: true })

const dayShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const shortDate = (s) => dayShort.format(new Date(`${s}T00:00:00`))
</script>

<template>
  <section class="tsp" aria-label="ยางที่ขายในเที่ยวนี้">
    <div class="tsp__head">
      <h3>ยางที่ขายในเที่ยวนี้ <small>เลือกจากยางรอขาย · ผูกกับวันที่ซื้อ เพื่อทำบิลอ้างอิงราคาของวันนั้น</small></h3>
      <label v-if="!isFoamTrip" class="tsp__foam"><input type="checkbox" :checked="includeFoam" @change="setFoam($event.target.checked)" /> นับขี้ฟองรวมในเที่ยวนี้</label>
    </div>

    <p v-if="error" class="tsp__err" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>
    <p v-else-if="loading && !data" class="tsp__empty">กำลังโหลดยางรอขาย…</p>
    <p v-else-if="data && !allBills.length" class="tsp__empty">ไม่มียางรอขาย — ไม่มียางที่รับซื้อแล้วและยังไม่ได้ขาย (ยังบันทึกเที่ยวโดยกรอกน้ำหนักเองได้)</p>

    <template v-else-if="data">
      <div v-for="g in groups" v-show="g.count" :key="g.hold" class="grp" :class="{ 'grp--night': g.hold === 'OVERNIGHT' }">
        <div class="grp__head">
          <b>{{ g.label }}</b>
          <span>{{ g.count }} ใบ · ก้อนถ้วย {{ formatNumber(g.cup) }} กก.<template v-if="g.foam > 0"> · ขี้ฟอง {{ formatNumber(g.foam) }} กก.</template></span>
          <span class="grp__act"><button type="button" @click="toggleGroup(g, true)">เลือกทั้งหมด</button><button type="button" @click="toggleGroup(g, false)">ล้าง</button></span>
        </div>
        <ul class="days">
          <li v-for="d in g.days" :key="d.date" class="day">
            <div class="day__row">
              <input type="checkbox" :checked="dayState(d).all" :indeterminate.prop="dayState(d).some" :disabled="dayState(d).none" :aria-label="`เลือกยางที่ซื้อวันที่ ${formatThaiDate(d.date)}`" @change="toggleDay(d)" />
              <button type="button" class="day__name" :aria-expanded="!!open[g.hold + ':' + d.date]" @click="open[g.hold + ':' + d.date] = !open[g.hold + ':' + d.date]">
                <span class="chev" :class="{ up: open[g.hold + ':' + d.date] }">▸</span> ซื้อวันที่ <b>{{ formatThaiDate(d.date) }}</b> <i>{{ d.bills.length }} ใบ</i>
              </button>
              <span class="day__kg">ก้อนถ้วย {{ formatNumber(d.bills.reduce((a, b) => a + b.cupKg, 0)) }}<template v-if="d.bills.some((b) => b.foamKg > 0)"> · ขี้ฟอง {{ formatNumber(d.bills.reduce((a, b) => a + b.foamKg, 0)) }}</template> กก.</span>
            </div>
            <ul v-if="open[g.hold + ':' + d.date]" class="bills">
              <li v-for="b in d.bills" :key="b.id" :class="{ off: !usable(b) }">
                <input type="checkbox" :checked="sel.has(b.id)" :disabled="!usable(b)" :aria-label="`เลือกใบ ${b.no}`" @change="toggleBill(b)" />
                <span class="b__no">{{ b.no }} <small>{{ b.time }} · {{ b.customer }}</small></span>
                <span class="b__kg">{{ formatNumber(b.cupKg) }}<template v-if="b.foamKg > 0"> + <em>{{ formatNumber(b.foamKg) }}</em></template> กก.</span>
                <span v-if="b.partial" class="b__tag">ขายบางส่วนแล้ว</span>
                <span v-else-if="!usable(b)" class="b__tag b__tag--warn">{{ isFoamTrip ? 'ไม่มีขี้ฟอง' : 'มีแต่ขี้ฟอง — ติ๊ก “นับขี้ฟอง”' }}</span>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>

    <p v-if="missing" class="tsp__err">มี {{ missing }} ใบที่เลือกไว้แต่ไม่อยู่ในยางรอขายแล้ว (ขายไปแล้วหรือถูกยกเลิก) — ล้างหรือเลือกใหม่ก่อนบันทึก</p>

    <div class="tsp__sum" :class="{ on: totals.bills }" role="status">
      <template v-if="totals.bills">
        เลือก <b>{{ totals.bills }}</b> ใบ ({{ totals.days.map(shortDate).join(', ') }})
        <span v-if="!isFoamTrip">· ก้อนถ้วย <b>{{ formatNumber(totals.cupKg) }}</b> กก.</span><span v-if="totals.foamKg > 0">· ขี้ฟอง <b>{{ formatNumber(totals.foamKg) }}</b> กก.</span>
        <span class="tsp__tot">รวม {{ formatNumber(totals.kg) }} กก.</span>
      </template>
      <template v-else>ยังไม่ได้เลือกยาง — เที่ยวนี้จะไม่ผูกกับใบรับซื้อ (ต้นทุนคิดแบบเข้าก่อนออกก่อน)</template>
    </div>
  </section>
</template>

<style scoped>
.tsp { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); }
.tsp__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.tsp__head h3 { font-size: 13px; font-weight: 800; color: var(--blue-700); } .tsp__head h3 small { display: block; font-size: 11px; font-weight: 500; color: var(--slate-500); }
.tsp__foam { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 9999px; border: 1px solid #fcd34d; background: var(--amber-50); font-size: 12px; font-weight: 700; color: var(--amber-700); cursor: pointer; }
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
</style>

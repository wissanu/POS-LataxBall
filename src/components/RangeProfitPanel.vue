<script setup>
// สรุปกำไรตามช่วงวัน — สำหรับยางที่พักค้างคืน 1-7 คืน และวันที่ขายยางบางส่วน/ค้างบางส่วน
//   ต้นทุนยางที่ขาย = เข้าก่อนออกก่อน (FIFO): เที่ยวขนส่งตัดจากยางที่ซื้อ "เก่าสุดก่อน" ที่ยังเหลืออยู่ ที่เหลือคือ "ยางค้างสต็อก"
//   กำไร = รายรับบิลโรงงาน − ต้นทุนยางที่ขายไป − ค่าคนงาน/ค่าขนส่ง/อื่น ๆ ในช่วง
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { financeService } from '@/services/financeService'
import { getErrorMessage } from '@/services/http'
import { bangkokDate, formatThaiDate, monthStart } from '@/utils/dates'
import { productLabel } from '@/utils/finance'
import { formatKg, formatMoney, formatNumber } from '@/utils/format'

const today = bangkokDate()
const PRESETS = [
  { v: 'today', label: 'วันนี้', from: () => today, to: () => today },
  { v: 'month', label: 'เดือนนี้', from: () => monthStart(today), to: () => today },
]
const preset = ref('month')
const range = reactive({ from: monthStart(today), to: today })
const data = ref(null)
const loading = ref(false)
const error = ref('')
let req = 0

function pick(p) {
  preset.value = p.v
  range.from = p.from(); range.to = p.to()
}
const custom = () => { preset.value = 'custom' }
const rangeError = computed(() => (!range.from || !range.to ? 'เลือกช่วงวันที่' : range.from > range.to ? 'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด' : ''))

async function load() {
  if (rangeError.value) return
  const id = ++req
  loading.value = true
  error.value = ''
  try {
    const res = await financeService.range(range.from, range.to)
    if (id === req) data.value = res
  } catch (e) {
    if (id === req) error.value = getErrorMessage(e, 'โหลดสรุปกำไรตามช่วงวันไม่สำเร็จ')
  } finally {
    if (id === req) loading.value = false
  }
}
onMounted(load)
watch([() => range.from, () => range.to], load)

const s = computed(() => data.value?.summary)
const expense = computed(() => (s.value ? s.value.labor + s.value.transport + s.value.other : 0))
const hasBill = computed(() => (s.value?.billTrips ?? 0) > 0)
const profitTone = computed(() => (hasBill.value && s.value.profit < 0 ? 'loss' : hasBill.value ? 'net' : 'wait'))
const periodText = computed(() => (range.from === range.to ? formatThaiDate(range.from) : `${formatThaiDate(range.from)} – ${formatThaiDate(range.to)}`))
// % สูญเสียน้ำของเที่ยว = (ส่ง − โรงงานชั่งได้) ÷ ส่ง · รวม = ถ่วงน้ำหนักทุกเที่ยวในช่วง
const lossPct = (t) => (t.shippedKg > 0 ? ((t.shippedKg - t.factoryNetKg) / t.shippedKg) * 100 : 0)
const lossTone = (t) => (lossPct(t) > 0 ? 'lossy' : '')
const totalLoss = computed(() => {
  const ts = data.value?.trips ?? []
  const shipped = ts.reduce((a, t) => a + t.shippedKg, 0)
  return shipped > 0 ? ((shipped - ts.reduce((a, t) => a + t.factoryNetKg, 0)) / shipped) * 100 : null
})
const nightsText = (n) => (n == null ? '–' : n < 0.05 ? 'ซื้อ-ขายวันเดียวกัน' : `${formatNumber(n)} คืน`)
const dayShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const srcText = (x) => `${dayShort.format(new Date(`${x.date}T00:00:00`))} · ${formatNumber(x.kg)} กก.`
</script>

<template>
  <div class="rp">
    <div class="rp__bar">
      <div class="rp__presets" role="group" aria-label="ช่วงวัน">
        <button v-for="p in PRESETS" :key="p.v" type="button" :class="{ on: preset === p.v }" :aria-pressed="preset === p.v" @click="pick(p)">{{ p.label }}</button>
        <button type="button" :class="{ on: preset === 'custom' }" :aria-pressed="preset === 'custom'" @click="custom">กำหนดเอง</button>
      </div>
      <label class="rp__d"><span>ตั้งแต่</span><input v-model="range.from" type="date" :max="today" @input="custom" /></label>
      <label class="rp__d"><span>ถึง</span><input v-model="range.to" type="date" :max="today" @input="custom" /></label>
      <span v-if="rangeError" class="rp__err">{{ rangeError }}</span>
    </div>
    <p class="rp__help">ขายยางค้างคืนหรือขายบางส่วน? เลือกช่วงให้ครอบคลุมทั้ง “วันที่ซื้อ” และ “วันที่ส่งขาย” — ระบบตัดยางที่ซื้อเก่าสุดก่อน (เข้าก่อนออกก่อน) แล้วคิดกำไรตามต้นทุนยางที่ขายไปจริง</p>

    <p v-if="error" class="rp__err" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>

    <div v-if="s" class="rp__body" :class="{ busy: loading }">
      <!-- สรุปตัวเลข -->
      <div class="cards">
        <div class="c c--buy"><small>ราคารับซื้อทั้งหมด</small><b>{{ formatMoney(s.purchaseTotal) }}</b><span>{{ s.bills }} ใบ · {{ formatKg(s.purchaseKg) }}</span></div>
        <div class="c c--in"><small>รายรับ (บิลโรงงาน)</small><b>{{ hasBill ? formatMoney(s.revenue) : '—' }}</b><span>{{ s.billTrips }}/{{ s.trips }} เที่ยวมียอดบิล · ส่ง {{ formatKg(s.shippedKg) }}</span></div>
        <div class="c c--cogs"><small>ต้นทุนยางที่ขายไป</small><b>{{ formatMoney(s.cogs) }}</b><span>ตัดจากยางที่ซื้อเก่าสุดก่อน</span></div>
        <div class="c c--exp"><small>ค่าใช้จ่ายอื่น</small><b>{{ formatMoney(expense) }}</b><span>คนงาน {{ formatMoney(s.labor) }} · ขนส่ง {{ formatMoney(s.transport) }} · อื่น ๆ {{ formatMoney(s.other) }}</span></div>
        <div class="c c--net" :class="`c--${profitTone}`"><small>กำไรสุทธิ ({{ periodText }})</small><b>{{ hasBill ? formatMoney(s.profit) : '—' }}</b><span>เทียบแบบเงินสด (รายรับ − ซื้อยาง − ค่าใช้จ่าย) {{ hasBill ? formatMoney(s.cashProfit) : '—' }}</span></div>
      </div>

      <p v-if="s.unbilledTrips" class="note note--warn">มี {{ s.unbilledTrips }} เที่ยวที่ยังไม่กรอกยอดบิลโรงงาน — ยังไม่นับทั้งรายรับและต้นทุนของเที่ยวนั้น (แต่ตัดยางออกจากสต็อกแล้ว) กรอกยอดบิลที่เมนู “การขนส่ง”</p>
      <p v-if="s.uncoveredKg > 0" class="note note--warn">ส่งขายเกินยางที่บันทึกซื้อไว้ {{ formatKg(s.uncoveredKg) }} (ไม่มีต้นทุนให้ตัด) — กำไรอาจสูงเกินจริง ตรวจว่าเลือกช่วงวันครอบคลุมวันซื้อ หรือมีใบรับซื้อที่ยังไม่ยืนยันอยู่หรือไม่</p>

      <!-- รอบขาย: ยางที่ส่งแต่ละเที่ยวมาจากการซื้อวันไหน -->
      <h3 class="h">รอบขายในช่วงนี้ <small>ยางที่ส่งแต่ละเที่ยวมาจากการซื้อวันไหน<template v-if="totalLoss != null"> · สูญเสียน้ำรวม <b>{{ formatNumber(totalLoss) }}%</b></template></small></h3>
      <p v-if="!data.trips.length" class="rp__empty">ไม่มีเที่ยวขนส่งในช่วงนี้</p>
      <div v-else class="tw">
        <table class="tb">
          <thead><tr><th>วันที่ขาย / เที่ยว</th><th class="r">ส่ง (กก.)</th><th class="r">สูญเสียน้ำ</th><th>ยางมาจากการซื้อ</th><th class="r">ค้างเฉลี่ย</th><th class="r">ต้นทุนยาง</th><th class="r">ยอดบิลโรงงาน</th><th class="r">กำไรขั้นต้น</th></tr></thead>
          <tbody>
            <tr v-for="t in data.trips" :key="t.id">
              <td><b>{{ formatThaiDate(t.date) }}</b><br /><small>เที่ยวที่ {{ t.tripNo }} · {{ productLabel(t.productType) }}</small></td>
              <td class="r">{{ formatNumber(t.shippedKg) }}<template v-if="t.stockKg != null && t.stockKg !== t.shippedKg"><br /><small>ตัดสต็อก {{ formatNumber(t.stockKg) }}</small></template></td>
              <td class="r" :class="lossTone(t)"><b>{{ formatNumber(lossPct(t)) }}%</b><br /><small>{{ formatNumber(t.shippedKg - t.factoryNetKg) }} กก.</small></td>
              <td class="src"><span v-for="x in t.sources" :key="x.date" class="chip" :class="{ old: x.nights > 0 }">{{ srcText(x) }}<i v-if="x.nights > 0"> ({{ x.nights }} คืน)</i></span><span v-if="t.uncoveredKg > 0" class="chip chip--bad">ไม่พบยางซื้อ {{ formatNumber(t.uncoveredKg) }} กก.</span></td>
              <td class="r">{{ nightsText(t.avgNights) }}</td>
              <td class="r">{{ formatMoney(t.cost) }}</td>
              <td class="r">{{ t.factoryAmount != null ? formatMoney(t.factoryAmount) : '–' }}</td>
              <td class="r" :class="{ neg: t.profit != null && t.profit < 0 }"><b>{{ t.profit != null ? formatMoney(t.profit) : 'รอบิล' }}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">กำไรขั้นต้น = ยอดบิลโรงงาน − ต้นทุนยางที่ส่งไป (ยังไม่หักค่าคนงาน/ค่าขนส่ง/อื่น ๆ ซึ่งหักรวมที่ “กำไรสุทธิ” ด้านบน)</p>
    </div>
    <p v-else-if="loading" class="rp__empty">กำลังโหลด…</p>
  </div>
</template>

<style scoped>
.rp { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.rp__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.rp__presets { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; }
.rp__presets button { padding: 6px 12px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); }
.rp__presets button.on { background: var(--blue-50); color: var(--blue-700); font-weight: 700; }
.rp__d { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-500); }
.rp__d input { height: 32px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: 10px; font: inherit; font-size: 12px; color: var(--slate-800); background: #fff; }
.rp__help { font-size: 11px; line-height: 1.6; color: var(--slate-500); }
.rp__err { font-size: 12px; color: #dc2626; } .rp__err button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.rp__empty { font-size: 12px; color: var(--slate-400); padding: 8px 0; }
.rp__body { display: flex; flex-direction: column; gap: 10px; transition: opacity .15s; } .rp__body.busy { opacity: .6; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.c { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--slate-50); border: 1px solid var(--slate-100); border-left: 4px solid var(--slate-300); }
.c small { font-size: 11px; font-weight: 700; color: var(--slate-600); } .c b { font-size: 19px; font-weight: 800; letter-spacing: -.3px; color: var(--slate-900); line-height: 1.3; font-variant-numeric: tabular-nums; } .c span { font-size: 10px; line-height: 1.5; color: var(--slate-500); }
.c--buy { border-left-color: #d97706; } .c--in { border-left-color: #16a34a; } .c--cogs { border-left-color: #ea580c; } .c--exp { border-left-color: #a16207; } .c--stock { border-left-color: #7c3aed; }
.c--net { grid-column: span 2; background: var(--blue-50); border-left-color: var(--blue-600); } .c--net b { font-size: 24px; color: var(--blue-700); }
.c--loss { background: var(--red-50); border-left-color: #dc2626; } .c--loss b { color: var(--red-700); } .c--wait { background: var(--slate-50); border-left-color: var(--slate-300); } .c--wait b { color: var(--slate-400); }
.note { font-size: 11px; line-height: 1.6; color: var(--slate-400); } .note--warn { padding: 8px 12px; border-radius: 10px; background: var(--amber-50); color: var(--amber-700); font-weight: 600; }
.h { font-size: 13px; font-weight: 800; color: var(--slate-800); margin-top: 4px; } .h small { font-weight: 500; font-size: 11px; color: var(--slate-400); margin-left: 6px; }
.tw { overflow-x: auto; border: 1px solid var(--slate-100); border-radius: var(--radius-md); background: #fff; }
.tb { width: 100%; border-collapse: collapse; font-size: 12px; }
.tb th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; color: var(--slate-500); background: var(--slate-50); white-space: nowrap; }
.tb td { padding: 8px 12px; border-top: 1px solid var(--slate-100); vertical-align: top; color: var(--slate-800); font-variant-numeric: tabular-nums; }
.tb .r { text-align: right; } .tb small { color: var(--slate-400); } .tb .neg b { color: #dc2626; }
.src { display: flex; flex-wrap: wrap; gap: 4px; min-width: 220px; }
.chip { padding: 2px 9px; border-radius: 9999px; font-size: 11px; background: #f0fdf4; color: #15803d; border: 1px solid #86efac; white-space: nowrap; } .chip i { font-style: normal; opacity: .8; }
.chip.old { background: #f5f3ff; color: #6d28d9; border-color: #c4b5fd; } .chip--bad { background: var(--red-50); color: var(--red-700); border-color: #fecaca; }
.tog { align-self: flex-start; font-size: 12px; font-weight: 700; color: var(--slate-600); }
@media (max-width: 700px) { .c--net { grid-column: span 1; } }
.lossy b { color: #b45309; }
</style>

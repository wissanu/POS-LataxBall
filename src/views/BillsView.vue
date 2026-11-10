<script setup>
// บิล: บิลขายโรงงาน (1 เที่ยวขนส่ง = 1 บิล เลขที่ SAL-วันที่ขาย-เที่ยว) อ้างอิงว่ายางซื้อมาวันไหน ราคาวันนั้นเท่าไร
//   ขายวันที่ 9 แต่ยางซื้อวันที่ 3,4,5 → ค้นวันที่ 3 / 4 / 5 (ค้นตาม "วันที่ซื้อยาง") เจอบิลรวบยอดใบเดียวกัน
//   แผง "สรุปกำไร" (รายวัน + ช่วงวัน/ยางค้างคืน) อยู่ที่หน้านี้ เพราะเป็นเรื่องของบิลขายโรงงาน
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import DailyProfitPanel from '@/components/DailyProfitPanel.vue'
import { billsService } from '@/services/billsService'
import { getErrorMessage } from '@/services/http'
import { addDays, bangkokDate, formatThaiDate } from '@/utils/dates'
import { productLabel } from '@/utils/finance'
import { formatKg, formatMoney, formatNumber } from '@/utils/format'

const today = bangkokDate()
const PRESETS = [
  { v: '7d', label: '7 วัน', from: () => addDays(today, -6) },
  { v: '30d', label: '30 วัน', from: () => addDays(today, -29) },
  { v: 'today', label: 'วันนี้', from: () => today },
]
const preset = ref('7d')
const range = reactive({ from: addDays(today, -6), to: today })
const basis = ref('buy') // buy = ค้นตามวันที่ซื้อยาง · sale = ค้นตามวันที่ขายให้โรงงาน
const q = ref('')
const data = ref(null)
const loading = ref(false)
const error = ref('')
const open = ref(new Set())
const focusId = ref('')
let timer = null; let req = 0

function pick(p) { preset.value = p.v; range.from = p.from(); range.to = today }
const rangeError = computed(() => (!range.from || !range.to ? 'เลือกช่วงวันที่' : range.from > range.to ? 'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด' : ''))

async function load() {
  if (rangeError.value) return
  const id = ++req
  loading.value = true; error.value = ''
  try {
    const res = await billsService.list({ from: range.from, to: range.to, basis: basis.value, q: q.value.trim() || undefined })
    if (id === req) data.value = res
  } catch (e) { if (id === req) error.value = getErrorMessage(e, 'โหลดบิลไม่สำเร็จ') } finally { if (id === req) loading.value = false }
}
onMounted(load)
watch([() => range.from, () => range.to, basis], load)
watch(q, () => { clearTimeout(timer); timer = setTimeout(load, 300) })
onBeforeUnmount(() => clearTimeout(timer))

const sales = computed(() => data.value?.sales ?? [])
const days = computed(() => data.value?.days ?? [])
const toggle = (id) => { const s = new Set(open.value); s.has(id) ? s.delete(id) : s.add(id); open.value = s }
function jumpTo(id) {
  focusId.value = id
  const s = new Set(open.value); s.add(id); open.value = s
  document.getElementById(`bill-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
const dayFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const sd = (d) => dayFmt.format(new Date(`${d}T00:00:00`))
const matched = (s, d) => s.matchedDates.includes(d)
const billTotal = computed(() => ({
  count: sales.value.length,
  amount: sales.value.reduce((a, s) => a + (s.factoryAmount ?? 0), 0),
  profit: sales.value.reduce((a, s) => a + (s.profit ?? 0), 0),
}))
</script>

<template>
  <section class="bills">
    <header class="head">
      <div>
        <h1>บิล</h1>
        <p>บิลขายโรงงานอ้างอิงวันที่ซื้อยางและราคารับซื้อของวันนั้น · ขายรวมหลายวันก็ค้นเจอจากวันที่ซื้อ</p>
      </div>
    </header>

    <!-- สรุปกำไร (ย้ายมาจากหน้า Order List) -->
    <DailyProfitPanel class="pp" default-open />

    <div class="filters">
      <div class="seg" role="group" aria-label="ค้นตามวันที่">
        <button type="button" :class="{ on: basis === 'buy' }" :aria-pressed="basis === 'buy'" @click="basis = 'buy'">ค้นตามวันที่ซื้อยาง</button>
        <button type="button" :class="{ on: basis === 'sale' }" :aria-pressed="basis === 'sale'" @click="basis = 'sale'">ค้นตามวันที่ขาย</button>
      </div>
      <div class="seg" role="group" aria-label="ช่วงวัน">
        <button v-for="p in PRESETS" :key="p.v" type="button" :class="{ on: preset === p.v }" @click="pick(p)">{{ p.label }}</button>
      </div>
      <label class="d"><span>ตั้งแต่</span><input v-model="range.from" type="date" :max="today" @input="preset = 'custom'" /></label>
      <label class="d"><span>ถึง</span><input v-model="range.to" type="date" :max="today" @input="preset = 'custom'" /></label>
      <label class="s"><AppIcon name="search" :size="14" /><input v-model="q" type="search" placeholder="ค้นเลขบิลขาย เช่น SAL-20261109" aria-label="ค้นเลขบิลขาย" /></label>
      <span v-if="rangeError" class="err">{{ rangeError }}</span>
    </div>
    <p class="hint">{{ basis === 'buy' ? 'แสดงบิลขายโรงงานที่มียางซื้อในช่วงวันที่เลือก (แม้ขายวันอื่น) และสรุปแต่ละวันที่ซื้อ' : 'แสดงบิลขายโรงงานที่ขายในช่วงวันที่เลือก และวันที่ซื้อยางที่บิลเหล่านั้นอ้างถึง' }}</p>

    <p v-if="error" class="err" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>

    <div class="grid" :class="{ busy: loading }">
      <!-- รายวันที่ซื้อยาง -->
      <section class="panel">
        <h2>วันที่ซื้อยาง <small>ซื้อเท่าไร · ขายให้โรงงานแล้วหรือยัง</small></h2>
        <p v-if="data && !days.length" class="empty">ไม่มียางที่ซื้อในช่วงนี้</p>
        <table v-else-if="days.length" class="tb">
          <thead><tr><th>วันที่ซื้อ</th><th class="r">ใบ</th><th class="r">ก้อนถ้วย</th><th class="r">ขี้ฟอง</th><th class="r">ต้นทุน</th><th>ยังรอขาย</th><th>บิลขายที่อ้างถึง</th></tr></thead>
          <tbody>
            <tr v-for="d in days" :key="d.date">
              <td><b>{{ formatThaiDate(d.date) }}</b></td>
              <td class="r">{{ d.bills }}</td>
              <td class="r">{{ formatNumber(d.cupKg) }}</td>
              <td class="r">{{ d.foamKg > 0 ? formatNumber(d.foamKg) : '–' }}</td>
              <td class="r">{{ formatMoney(d.amount) }}</td>
              <td>
                <template v-if="d.waitingSameDay || d.waitingOvernight">
                  <span v-if="d.waitingSameDay" class="chip">ขายต่อวัน {{ d.waitingSameDay }} ใบ</span>
                  <span v-if="d.waitingOvernight" class="chip chip--night">ค้างคืน {{ d.waitingOvernight }} ใบ</span>
                  <small class="left">เหลือ {{ formatKg(d.leftCupKg) }}<template v-if="d.leftFoamKg > 0"> + ขี้ฟอง {{ formatKg(d.leftFoamKg) }}</template></small>
                </template>
                <span v-else class="chip chip--ok">ขายหมดแล้ว</span>
              </td>
              <td>
                <button v-for="id in d.saleBillIds" :key="id" type="button" class="link" @click="jumpTo(id)">{{ sales.find((s) => s.id === id)?.no }}</button>
                <span v-if="!d.saleBillIds.length" class="muted">–</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- บิลขายโรงงาน -->
      <section class="panel">
        <h2>บิลขายโรงงาน <small v-if="sales.length">{{ billTotal.count }} บิล · ยอดบิล {{ formatMoney(billTotal.amount) }} · กำไรขั้นต้น {{ formatMoney(billTotal.profit) }}</small></h2>
        <p v-if="data && !sales.length" class="empty">ไม่พบบิลขายโรงงานในช่วงนี้{{ basis === 'buy' ? ' (ลองค้นตามวันที่ขาย หรือเที่ยวที่ยังไม่ได้เลือกยางต้นทางจะค้นเจอเฉพาะตามวันที่ขาย)' : '' }}</p>
        <ul class="sales">
          <li v-for="s in sales" :id="`bill-${s.id}`" :key="s.id" class="sale" :class="{ focus: focusId === s.id }">
            <button type="button" class="sale__head" :aria-expanded="open.has(s.id)" @click="toggle(s.id)">
              <span class="chev" :class="{ up: open.has(s.id) }">▸</span>
              <b class="no">{{ s.no }}</b>
              <span class="when">ขาย {{ formatThaiDate(s.saleDate) }} · เที่ยวที่ {{ s.tripNo }}<template v-if="s.productType === 'FOAM'"> · <em>ขี้ฟอง</em></template></span>
              <span class="src">
                <template v-if="s.sources.length"><span v-for="x in s.sources" :key="x.date" class="schip" :class="{ hit: matched(s, x.date) && basis === 'buy' }">ซื้อ {{ sd(x.date) }}</span></template>
                <span v-else class="muted">ไม่ได้ระบุยางต้นทาง</span>
              </span>
              <span class="num">ยอดบิล <b>{{ s.factoryAmount != null ? formatMoney(s.factoryAmount) : 'รอบิล' }}</b></span>
              <span class="num" :class="{ neg: s.profit != null && s.profit < 0 }">กำไรขั้นต้น <b>{{ s.profit != null ? formatMoney(s.profit) : '–' }}</b></span>
            </button>

            <div v-if="open.has(s.id)" class="sale__body">
              <p class="meta">ส่ง {{ formatKg(s.shippedKg) }} → โรงงานชั่งได้ {{ formatKg(s.factoryNetKg) }} (สูญเสีย {{ formatNumber(s.lossPct) }}%)<template v-if="s.factoryPricePerKg"> · ราคาโรงงาน {{ formatMoney(s.factoryPricePerKg) }}/กก.</template> · {{ productLabel(s.productType) }}</p>
              <p v-if="s.legacy" class="muted">เที่ยวนี้บันทึกโดยไม่ได้เลือกยางต้นทาง — ต้นทุนคิดแบบเข้าก่อนออกก่อนในสรุปกำไร (ดูได้ที่แผงสรุปกำไร › ช่วงวัน)</p>
              <table v-else class="tb tb--in">
                <thead><tr><th>ยางที่ซื้อวันที่</th><th class="r">ใบ</th><th class="r">ก้อนถ้วย</th><th class="r">ขี้ฟอง</th><th class="r">ต้นทุน</th><th class="r">เฉลี่ย/กก.</th><th>ราคารับซื้อวันนั้น (เกรด @ ราคา · กก.)</th></tr></thead>
                <tbody>
                  <tr v-for="x in s.sources" :key="x.date" :class="{ hit: matched(s, x.date) && basis === 'buy' }">
                    <td><b>{{ formatThaiDate(x.date) }}</b></td>
                    <td class="r">{{ x.bills }}</td>
                    <td class="r">{{ formatNumber(x.cupKg) }}</td>
                    <td class="r">{{ x.foamKg > 0 ? formatNumber(x.foamKg) : '–' }}</td>
                    <td class="r">{{ formatMoney(x.cost) }}</td>
                    <td class="r">{{ formatMoney(x.avgPrice) }}</td>
                    <td class="lines"><span v-for="l in x.lines" :key="l.grade + l.price" class="ln">{{ l.grade }} @{{ formatNumber(l.price) }} · {{ formatNumber(l.kg) }} กก.</span></td>
                  </tr>
                </tbody>
                <tfoot><tr><td colspan="4">รวมต้นทุนยางที่ขาย</td><td class="r"><b>{{ formatMoney(s.cost) }}</b></td><td colspan="2" class="r">ยอดบิล {{ s.factoryAmount != null ? formatMoney(s.factoryAmount) : '–' }} → กำไรขั้นต้น <b>{{ s.profit != null ? formatMoney(s.profit) : '–' }}</b></td></tr></tfoot>
              </table>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.bills { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; overflow-y: auto; padding-bottom: 12px; }
.head h1 { font-size: 28px; font-weight: 800; letter-spacing: -.5px; color: var(--slate-900); } .head p { font-size: 12px; color: var(--slate-500); margin-top: 2px; }
.pp { margin-top: 0; }
.filters { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
.seg { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; }
.seg button { padding: 6px 12px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); } .seg button.on { background: var(--blue-50); color: var(--blue-700); font-weight: 700; }
.d { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-500); } .d input, .s input { height: 32px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: 10px; font: inherit; font-size: 12px; color: var(--slate-800); background: #fff; }
.s { display: inline-flex; align-items: center; gap: 6px; color: var(--slate-400); } .s input { width: 230px; }
.hint { font-size: 11px; color: var(--slate-500); } .err { font-size: 12px; color: #dc2626; } .err button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.grid { display: flex; flex-direction: column; gap: 12px; transition: opacity .15s; } .grid.busy { opacity: .6; }
.panel { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.panel h2 { font-size: 14px; font-weight: 800; color: var(--slate-900); } .panel h2 small { font-weight: 500; font-size: 11px; color: var(--slate-500); margin-left: 8px; }
.empty { font-size: 12px; color: var(--slate-500); padding: 6px 0; } .muted { color: var(--slate-400); font-size: 12px; }
.tb { width: 100%; border-collapse: collapse; font-size: 12px; } .tb th { text-align: left; padding: 6px 10px; font-size: 11px; color: var(--slate-500); background: var(--slate-50); white-space: nowrap; }
.tb td { padding: 6px 10px; border-top: 1px solid var(--slate-100); color: var(--slate-800); font-variant-numeric: tabular-nums; vertical-align: top; } .tb .r { text-align: right; }
.tb tfoot td { background: var(--slate-50); font-size: 12px; } .tb tr.hit td { background: #fefce8; }
.chip { padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: var(--blue-50); color: var(--blue-700); border: 1px solid var(--blue-100); margin-right: 4px; white-space: nowrap; }
.chip--night { background: #f5f3ff; color: #6d28d9; border-color: #c4b5fd; } .chip--ok { background: #f0fdf4; color: #15803d; border-color: #86efac; } .left { margin-left: 4px; color: var(--slate-400); }
.link { margin-right: 8px; font-size: 11px; font-weight: 700; color: var(--blue-700); text-decoration: underline; }
.sales { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.sale { border: 1px solid var(--slate-100); border-radius: var(--radius-md); background: var(--slate-50); overflow: hidden; transition: box-shadow .2s; } .sale.focus { box-shadow: 0 0 0 2px var(--blue-600); }
.sale__head { width: 100%; display: flex; align-items: center; gap: 8px 14px; flex-wrap: wrap; padding: 10px 14px; text-align: left; font-size: 12px; color: var(--slate-600); }
.chev { display: inline-block; font-size: 10px; transition: transform .15s; } .chev.up { transform: rotate(90deg); }
.no { font-size: 13px; color: var(--slate-900); } .when em { font-style: normal; color: var(--amber-700); font-weight: 700; }
.src { display: inline-flex; gap: 4px; flex-wrap: wrap; } .schip { padding: 1px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #f5f3ff; color: #6d28d9; border: 1px solid #c4b5fd; } .schip.hit { background: #fef9c3; color: #854d0e; border-color: #fde047; }
.num { margin-left: auto; } .num + .num { margin-left: 0; } .num b { color: var(--slate-900); font-variant-numeric: tabular-nums; } .num.neg b { color: #dc2626; }
.sale__body { padding: 4px 14px 12px; display: flex; flex-direction: column; gap: 8px; background: #fff; border-top: 1px solid var(--slate-100); }
.meta { font-size: 12px; color: var(--slate-600); } .lines { display: flex; flex-wrap: wrap; gap: 4px; } .ln { padding: 1px 8px; border-radius: 6px; background: var(--slate-50); border: 1px solid var(--slate-100); font-size: 11px; white-space: nowrap; }
.tb--in { border: 1px solid var(--slate-100); border-radius: 8px; overflow: hidden; }
</style>

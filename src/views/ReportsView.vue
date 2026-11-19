<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import SalesChart from '@/components/SalesChart.vue'
import PriceChart from '@/components/PriceChart.vue'
import LossTrendChart from '@/components/LossTrendChart.vue'
import ProfitChart from '@/components/ProfitChart.vue'
import ChartLabel from '@/components/ChartLabel.vue'
import BarList from '@/components/BarList.vue'
import { reportService } from '@/services/reportService'
import { transportService } from '@/services/transportService'
import { financeService } from '@/services/financeService'
import { calcProfit } from '@/utils/finance'
import { useAuthStore } from '@/stores/auth'
import { linearTrend, metricValue } from '@/utils/transport'
import { getErrorMessage } from '@/services/http'
import { formatKg, formatMoney, formatNumber, fromISODate } from '@/utils/format'
import { presetRange } from '@/utils/dates'

const PRESETS = [
  { v: 'today', label: 'วันนี้' },
  { v: 'month', label: 'เดือนนี้' },
  { v: 'custom', label: 'กำหนดเอง' },
]
const GROUPS = [{ v: 'day', label: 'รายวัน' }, { v: 'week', label: 'รายสัปดาห์' }, { v: 'month', label: 'รายเดือน' }]
const METRICS = [{ v: 'total', label: 'ยอดเงิน' }, { v: 'netKg', label: 'น้ำหนัก (กก.)' }]

const preset = ref('month')
const range = reactive({ from: '', to: '' })
const groupBy = ref('day')
const metric = ref('total')
const customer = ref(null) // customer key used to narrow the trend chart

const data = ref(null)
const loading = ref(false)
const error = ref('')
let requestId = 0

const daysBetween = (a, b) => Math.round((fromISODate(b) - fromISODate(a)) / 86400000) + 1
const rangeError = computed(() => {
  if (!range.from || !range.to) return 'เลือกวันที่เริ่มต้นและสิ้นสุด'
  if (range.from > range.to) return 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'
  if (daysBetween(range.from, range.to) > 400) return 'เลือกช่วงวันที่ได้ไม่เกิน 400 วัน'
  return ''
})

function applyPreset(v) {
  preset.value = v
  if (v === 'custom') return
  ;[range.from, range.to] = presetRange(v)
  // a sensible grouping for the length of the range (still changeable by hand)
  const n = daysBetween(range.from, range.to)
  groupBy.value = n <= 45 ? 'day' : n <= 150 ? 'week' : 'month'
}

async function load() {
  if (rangeError.value) return
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await reportService.overview({ from: range.from, to: range.to, groupBy: groupBy.value, ...(customer.value ? { customer: customer.value } : {}) })
    if (id === requestId) data.value = res // ignore answers that arrive after a newer request
  } catch (e) {
    if (id === requestId) error.value = getErrorMessage(e, 'โหลดรายงานไม่สำเร็จ')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch([() => range.from, () => range.to, groupBy, customer], load)
onMounted(() => applyPreset('month')) // changing the range triggers the first load

// ================= ราคารับซื้อรายวัน (ความผันผวนของราคาที่ตั้งหน้าร้าน) =================
const PRICE_PRESETS = [
  { v: 'today', label: 'วันนี้' },
  { v: 'month', label: 'เดือนนี้' },
  { v: 'custom', label: 'กำหนดเอง' },
]
const pricePreset = ref('month')
const priceRange = reactive({ from: '', to: '' })
const priceGrade = ref('all')
const priceData = ref(null)
const priceLoading = ref(false)
const priceError = ref('')
let priceReq = 0

const priceRangeError = computed(() => {
  if (!priceRange.from || !priceRange.to) return 'เลือกวันที่เริ่มต้นและสิ้นสุด'
  if (priceRange.from > priceRange.to) return 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'
  if (daysBetween(priceRange.from, priceRange.to) > 400) return 'เลือกช่วงวันที่ได้ไม่เกิน 400 วัน'
  return ''
})
function applyPricePreset(v) {
  pricePreset.value = v
  if (v === 'custom') return
  ;[priceRange.from, priceRange.to] = presetRange(v)
}
async function loadPrices() {
  if (priceRangeError.value) return
  const id = ++priceReq
  priceLoading.value = true
  priceError.value = ''
  try {
    const res = await reportService.prices({ from: priceRange.from, to: priceRange.to, grade: priceGrade.value })
    if (id === priceReq) priceData.value = res
  } catch (e) {
    if (id === priceReq) priceError.value = getErrorMessage(e, 'โหลดกราฟราคาไม่สำเร็จ')
  } finally {
    if (id === priceReq) priceLoading.value = false
  }
}
watch([() => priceRange.from, () => priceRange.to, priceGrade], loadPrices)
onMounted(() => applyPricePreset('month'))

const priceStats = computed(() => priceData.value?.stats)
const gradeName = (code) => priceData.value?.grades.find((g) => g.code === code)?.name ?? `เกรด ${code}`
const fmtDay = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const priceTiles = computed(() => {
  const s = priceStats.value
  if (!s) return []
  const where = (at) => `${fmtDay.format(fromISODate(at.date))}${priceGrade.value === 'all' ? ` · เกรด ${at.grade}` : ''}`
  return [
    { key: 'avg', label: 'ราคาเฉลี่ย', value: formatMoney(s.avg), sub: `จาก ${s.daysWithData} วันที่มีราคา (ทั้งช่วง ${s.days} วัน)` },
    { key: 'min', label: 'ต่ำสุด', value: formatMoney(s.min), sub: where(s.minAt) },
    { key: 'max', label: 'สูงสุด', value: formatMoney(s.max), sub: where(s.maxAt) },
  ]
})

// ================= น้ำหนักที่สูญเสียระหว่างขนส่ง (การขนส่งไปโรงงาน) — เฉพาะผู้มีสิทธิ์ transport.read (ผู้จัดการ/ผู้ดูแลระบบ) =================
const auth = useAuthStore()
const canTransport = computed(() => auth.can('transport.read'))
const LOSS_PRESETS = [
  { v: 'today', label: 'วันนี้' },
  { v: 'month', label: 'เดือนนี้' },
  { v: 'custom', label: 'กำหนดเอง' },
]
const LOSS_METRICS = [
  { v: 'lossKg', label: 'รวม (กก.)' },
  { v: 'avgKg', label: 'เฉลี่ย/เที่ยว (กก.)' },
  { v: 'lossPct', label: 'อัตรา (%)' },
]
const lossPreset = ref('month')
const lossRange = reactive({ from: '', to: '' })
const lossGroup = ref('day')
const lossMetric = ref('lossKg')
const lossData = ref(null)
const lossLoading = ref(false)
const lossError = ref('')
let lossReq = 0

const lossRangeError = computed(() => {
  if (!lossRange.from || !lossRange.to) return 'เลือกวันที่เริ่มต้นและสิ้นสุด'
  if (lossRange.from > lossRange.to) return 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'
  if (daysBetween(lossRange.from, lossRange.to) > 400) return 'เลือกช่วงวันที่ได้ไม่เกิน 400 วัน'
  return ''
})
function applyLossPreset(v) {
  lossPreset.value = v
  if (v === 'custom') return
  ;[lossRange.from, lossRange.to] = presetRange(v)
  const n = daysBetween(lossRange.from, lossRange.to)
  lossGroup.value = n <= 45 ? 'day' : n <= 150 ? 'week' : 'month'
}
async function loadLoss() {
  if (!canTransport.value || lossRangeError.value) return
  const id = ++lossReq
  lossLoading.value = true
  lossError.value = ''
  try {
    const res = await transportService.report({ from: lossRange.from, to: lossRange.to, groupBy: lossGroup.value })
    if (id === lossReq) lossData.value = res
  } catch (e) {
    if (id === lossReq) lossError.value = getErrorMessage(e, 'โหลดกราฟการสูญเสียน้ำไม่สำเร็จ')
  } finally {
    if (id === lossReq) lossLoading.value = false
  }
}
watch([() => lossRange.from, () => lossRange.to, lossGroup], loadLoss)
onMounted(() => canTransport.value && applyLossPreset('month'))

const LOSS_COLORS = { MORNING: '#d97706', AFTERNOON: '#2563eb' }
const lossHasData = computed(() => !!lossData.value && Object.values(lossData.value.summary).some((s) => s.trips > 0))
// การ์ดสรุปรายช่วงเวลา: รวมทั้งช่วง + ทิศทางแนวโน้ม (ตามหน่วยที่เลือกอยู่ในกราฟ)
const lossTiles = computed(() => {
  const d = lossData.value
  if (!d) return []
  const metricName = LOSS_METRICS.find((x) => x.v === lossMetric.value).label
  return d.windows.map((w) => {
    const s = d.summary[w.key]
    const t = linearTrend(d.series.map((p) => metricValue(p[w.key], lossMetric.value)))
    const verdict = !t ? { cls: 'none', text: s.trips ? 'ข้อมูลยังน้อยเกินบอกแนวโน้ม' : 'ไม่มีเที่ยวขนส่ง' }
      : t.direction === 'up' ? { cls: 'up', text: `▲ สูญเสียมากขึ้น ${formatNumber(Math.abs(t.changePct))}%` }
      : t.direction === 'down' ? { cls: 'down', text: `▼ สูญเสียน้อยลง ${formatNumber(Math.abs(t.changePct))}%` }
      : { cls: 'flat', text: '● ทรงตัว' }
    return { key: w.key, label: w.label, name: w.key === 'MORNING' ? 'ช่วงเช้า' : 'ช่วงบ่าย', s, verdict, metricName }
  })
})

// ================= รายรับ - รายจ่าย - กำไร (ใช้ช่วงวันที่เดียวกับด้านบน) — เฉพาะ transport.read =================
const pGroup = ref('day')
const pData = ref(null)
const pLoading = ref(false)
const pError = ref('')
let pReq = 0
async function loadProfit() {
  if (!canTransport.value || rangeError.value) return
  const id = ++pReq
  pLoading.value = true
  pError.value = ''
  try {
    const res = await financeService.report({ from: range.from, to: range.to, groupBy: pGroup.value })
    if (id === pReq) pData.value = res
  } catch (e) {
    if (id === pReq) pError.value = getErrorMessage(e, 'โหลดกราฟรายรับ-รายจ่ายไม่สำเร็จ')
  } finally {
    if (id === pReq) pLoading.value = false
  }
}
watch([() => range.from, () => range.to, pGroup], loadProfit)
const pSum = computed(() => (pData.value ? calcProfit(pData.value.summary) : null))
const pHasData = computed(() => !!pData.value && pData.value.series.some((p) => p.revenue || p.purchase || p.labor || p.transport || p.other))
const pTiles = computed(() => {
  const s = pSum.value; const r = pData.value?.summary
  if (!s) return []
  return [
    { key: 'in', label: 'รายรับ (บิลโรงงาน)', value: formatMoney(s.revenue), sub: `${r.billTrips}/${r.trips} เที่ยวมียอดบิล` },
    { key: 'out', label: 'รายจ่ายรวม', value: formatMoney(s.expense), sub: `ซื้อยาง ${formatMoney(r.purchase)}` },
    { key: s.profit < 0 ? 'loss' : 'net', label: 'กำไรสุทธิ', value: formatMoney(s.profit), sub: s.margin != null ? `อัตรากำไร ${formatNumber(s.margin)}% ของรายรับ` : 'ยังไม่มีรายรับ' },
    { key: 'kg', label: 'กำไรต่อ กก.', value: r.factoryNetKg > 0 ? formatMoney(s.profit / r.factoryNetKg) : '–', sub: `โรงงานชั่งได้ ${formatKg(r.factoryNetKg)}` },
  ]
})
const expenseItems = computed(() => {
  const r = pData.value?.summary
  if (!r) return []
  return [
    { key: 'purchase', name: 'ซื้อยางจากลูกค้า', value: r.purchase },
    { key: 'labor', name: 'ค่าคนงาน', value: r.labor },
    { key: 'transport', name: 'ค่าขนส่ง / น้ำมัน', value: r.transport },
    { key: 'other', name: 'อื่น ๆ', value: r.other },
  ].filter((i) => i.value > 0)
})

// ป้ายแกนนอนตามการจัดกลุ่ม
const xName = (g) => (g === 'month' ? 'เดือน' : g === 'week' ? 'สัปดาห์ (วันเริ่มต้นสัปดาห์)' : 'วันที่')

// ทางลัดไปยังแต่ละกราฟ
const NAV = computed(() => [
  { id: 'c-buy', label: 'ยอดรับซื้อ' },
  ...(canTransport.value ? [{ id: 'c-profit', label: 'รายรับ-รายจ่าย-กำไร' }] : []),
  { id: 'c-price', label: 'ราคารับซื้อ' },
  ...(canTransport.value ? [{ id: 'c-loss', label: 'น้ำหายระหว่างขนส่ง' }] : []),
  { id: 'c-cust', label: 'รายลูกค้า' },
  { id: 'c-prod', label: 'ตามสินค้า' },
])
const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// ---- derived ----
const summary = computed(() => data.value?.summary)
const avgPrice = computed(() => (summary.value?.netKg ? summary.value.total / summary.value.netKg : 0))
const hasData = computed(() => (summary.value?.billCount ?? 0) > 0)

function delta(cur, prev) {
  if (!prev) return null
  const pct = ((cur - prev) / prev) * 100
  return { up: pct >= 0, text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%` }
}
const tiles = computed(() => {
  const s = summary.value
  if (!s) return []
  return [
    { label: 'ยอดรับซื้อรวม', value: formatMoney(s.total), delta: delta(s.total, s.previous.total) },
    { label: 'น้ำหนักสุทธิรวม', value: formatKg(s.netKg), delta: delta(s.netKg, s.previous.netKg) },
    { label: 'จำนวนบิล', value: formatNumber(s.billCount).replace(/\.00$/, ''), delta: delta(s.billCount, s.previous.billCount) },
    { label: 'ราคาเฉลี่ย / กก.', value: formatMoney(avgPrice.value), delta: null },
  ]
})

const customerItems = computed(() =>
  (data.value?.byCustomer ?? []).slice(0, 10).map((c) => ({ key: c.key, name: c.name, value: c.total, sub: `${formatKg(c.netKg)} · ${c.bills} บิล` })),
)
const productItems = computed(() => (data.value?.byProduct ?? []).map((p) => ({ key: p.key, name: p.name, value: p.total, sub: formatKg(p.netKg) })))
const customerName = computed(() => data.value?.byCustomer.find((c) => c.key === customer.value)?.name ?? '')

function pick(key) { customer.value = customer.value === key ? null : key }
</script>

<template>
  <section class="rep glass">
    <header class="head">
      <h1>รายงานภาพรวม</h1>
      <p>ยอดรับซื้อ · รายรับ-รายจ่าย-กำไร · ราคา · น้ำหายระหว่างขนส่ง ในช่วงเวลาที่เลือก</p>
      <nav class="jump" aria-label="ไปยังกราฟ"><span>กราฟในหน้านี้:</span><button v-for="n in NAV" :key="n.id" type="button" @click="jump(n.id)">{{ n.label }}</button></nav>
    </header>

    <div class="controls">
      <div class="seg" role="group" aria-label="ช่วงวันที่">
        <button v-for="p in PRESETS" :key="p.v" type="button" :class="{ on: preset === p.v }" :aria-pressed="preset === p.v" @click="applyPreset(p.v)">{{ p.label }}</button>
      </div>
      <div class="dates">
        <label>ตั้งแต่ <input v-model="range.from" type="date" :max="range.to || undefined" @input="preset = 'custom'" /></label>
        <label>ถึง <input v-model="range.to" type="date" :min="range.from || undefined" @input="preset = 'custom'" /></label>
      </div>
    </div>
    <p v-if="rangeError" class="warn" role="alert">{{ rangeError }}</p>

    <p v-if="error" class="state state--error" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>

    <div class="tiles" :class="{ busy: loading }">
      <div v-for="t in tiles" :key="t.label" class="tile">
        <span class="tile__label">{{ t.label }}</span>
        <b>{{ t.value }}</b>
        <span v-if="t.delta" class="tile__delta" :class="t.delta.up ? 'up' : 'down'">{{ t.delta.text }} <small>เทียบช่วงก่อนหน้า</small></span>
      </div>
      <div v-if="!tiles.length" class="tile tile--skeleton">กำลังโหลด…</div>
    </div>

    <div id="c-buy" class="panel">
      <div class="panel__head">
        <ChartLabel
          tag="ยอดรับซื้อ" tone="blue" :title="`ยอดรับซื้อจากลูกค้า${customer ? ' · ' + customerName : ''}`"
          desc="ร้านจ่ายเงินซื้อยางจากลูกค้าไปเท่าไหร่ในแต่ละช่วง (จากใบรับซื้อที่ยืนยันแล้ว) · เส้นประ = ค่าเฉลี่ย"
          :x="xName(groupBy)" :y="metric === 'total' ? 'ยอดเงินที่จ่ายให้ลูกค้า (บาท)' : 'น้ำหนักสุทธิที่รับซื้อ (กก.)'"
        />
        <div class="tools">
          <button v-if="customer" type="button" class="chip" @click="customer = null">เฉพาะ {{ customerName }} <AppIcon name="x" :size="12" /></button>
          <div class="seg seg--sm" role="group" aria-label="หน่วยที่แสดง">
            <button v-for="m in METRICS" :key="m.v" type="button" :class="{ on: metric === m.v }" :aria-pressed="metric === m.v" @click="metric = m.v">{{ m.label }}</button>
          </div>
          <div class="seg seg--sm" role="group" aria-label="จัดกลุ่มตาม">
            <button v-for="g in GROUPS" :key="g.v" type="button" :class="{ on: groupBy === g.v }" :aria-pressed="groupBy === g.v" @click="groupBy = g.v">{{ g.label }}</button>
          </div>
        </div>
      </div>
      <p v-if="data && !hasData" class="state">ไม่มีรายการรับซื้อในช่วงที่เลือก</p>
      <SalesChart v-else-if="data" :points="data.series" :metric="metric" :group-by="data.range.groupBy" :class="{ busy: loading }" />
      <p v-else-if="loading" class="state">กำลังโหลด…</p>
    </div>

    <!-- รายรับ - รายจ่าย - กำไร (เฉพาะผู้จัดการ/ผู้ดูแลระบบ) -->
    <div v-if="canTransport" id="c-profit" class="panel">
      <div class="panel__head">
        <ChartLabel
          tag="กำไร" tone="green" title="รายรับ - รายจ่าย - กำไรสุทธิ"
          desc="แท่งเขียว = เงินที่ได้จากบิลโรงงาน · แท่งส้ม = รายจ่ายรวม (ซื้อยาง + ค่าคนงาน + ค่าขนส่ง + อื่น ๆ) · เส้นน้ำเงิน = กำไรสุทธิ (จุดแดง = ขาดทุน)"
          :x="xName(pGroup)" y="จำนวนเงิน (บาท) — เส้นดำ = 0"
        />
        <div class="tools">
          <div class="seg seg--sm" role="group" aria-label="จัดกลุ่มตาม">
            <button v-for="g in GROUPS" :key="g.v" type="button" :class="{ on: pGroup === g.v }" :aria-pressed="pGroup === g.v" @click="pGroup = g.v">{{ g.label }}</button>
          </div>
        </div>
      </div>
      <p v-if="pError" class="state state--error" role="alert">{{ pError }} <button type="button" @click="loadProfit">ลองใหม่</button></p>
      <div class="ptiles" :class="{ busy: pLoading }">
        <div v-for="t in pTiles" :key="t.key" class="ptile" :class="`pt--${t.key}`">
          <span class="tile__label">{{ t.label }}</span>
          <b>{{ t.value }}</b>
          <span class="ptile__sub">{{ t.sub }}</span>
        </div>
      </div>
      <p v-if="pData && !pHasData" class="state">ไม่มีรายรับ/รายจ่ายในช่วงที่เลือก</p>
      <ProfitChart v-else-if="pData" :points="pData.series" :group-by="pData.range.groupBy" :class="{ busy: pLoading }" />
      <p v-else-if="pLoading" class="state">กำลังโหลด…</p>
      <ul v-if="pHasData" class="legend" aria-hidden="true">
        <li><i class="lg" style="background: #4ade80; height: 8px" /> รายรับ</li>
        <li><i class="lg" style="background: #fbbf24; height: 8px" /> รายจ่ายรวม</li>
        <li><i class="lg" style="background: #2563eb" /> กำไรสุทธิ</li>
        <li class="legend__gap">คิดตามวันที่เกิดรายการ: ซื้อยางวันหนึ่งแต่ขายอีกวัน จะเห็นขาดทุนชั่วคราว — ดูช่วงยาว/รายสัปดาห์จะตรงกว่า</li>
      </ul>
      <div v-if="expenseItems.length" class="exp">
        <ChartLabel tag="สัดส่วน" tone="amber" title="รายจ่ายไปอยู่ที่ไหนบ้าง" desc="แบ่งรายจ่ายรวมของช่วงที่เลือก (แท่งยาว = จ่ายมาก · % = สัดส่วนของรายจ่ายทั้งหมด)" />
        <BarList :items="expenseItems" :format="formatMoney" />
      </div>
    </div>

    <!-- ความผันผวนของราคารับซื้อรายวัน -->
    <div id="c-price" class="panel">
      <div class="panel__head">
        <ChartLabel
          tag="ราคา" tone="violet" title="ราคารับซื้อรายวัน (ที่ตั้งหน้าร้าน)"
          desc="ราคาต่อ กก. ที่ร้านประกาศรับซื้อในแต่ละวัน — ดูว่าราคาขึ้น/ลงอย่างไร ไม่ใช่ยอดเงินที่จ่ายจริง"
          x="วันที่" y="ราคารับซื้อ (บาท/กก.)"
        />
        <div class="tools">
          <label class="sel"><span class="sr-only">เกรด</span>
            <select v-model="priceGrade" aria-label="เลือกเกรด">
              <option value="all">ทุกเกรด (เฉลี่ย / ต่ำสุด / สูงสุด)</option>
              <option v-for="g in priceData?.grades ?? []" :key="g.code" :value="g.code">{{ g.name }}</option>
            </select>
          </label>
          <div class="seg seg--sm" role="group" aria-label="ช่วงวันที่ของราคา">
            <button v-for="p in PRICE_PRESETS" :key="p.v" type="button" :class="{ on: pricePreset === p.v }" :aria-pressed="pricePreset === p.v" @click="applyPricePreset(p.v)">{{ p.label }}</button>
          </div>
        </div>
      </div>
      <div v-if="pricePreset === 'custom'" class="dates dates--inline">
        <label>ตั้งแต่ <input v-model="priceRange.from" type="date" :max="priceRange.to || undefined" /></label>
        <label>ถึง <input v-model="priceRange.to" type="date" :min="priceRange.from || undefined" /></label>
      </div>
      <p v-if="priceRangeError" class="warn" role="alert">{{ priceRangeError }}</p>
      <p v-if="priceError" class="state state--error" role="alert">{{ priceError }} <button type="button" @click="loadPrices">ลองใหม่</button></p>

      <div class="ptiles" :class="{ busy: priceLoading }">
        <div v-for="t in priceTiles" :key="t.key" class="ptile" :class="`ptile--${t.key}`">
          <span class="tile__label">{{ t.label }}<template v-if="priceGrade !== 'all'"> · {{ gradeName(priceGrade) }}</template></span>
          <b>{{ t.value }} <small>/ กก.</small></b>
          <span class="ptile__sub">{{ t.sub }}</span>
        </div>
      </div>

      <p v-if="priceData && !priceStats" class="state">ไม่มีข้อมูลราคาในช่วงที่เลือก</p>
      <PriceChart v-else-if="priceData" :series="priceData.series" :grade="priceData.grade" :stats="priceStats" :class="{ busy: priceLoading }" />
      <p v-else-if="priceLoading" class="state">กำลังโหลด…</p>
      <ul v-if="priceStats && priceGrade === 'all'" class="legend" aria-hidden="true">
        <li><i class="lg lg--max" /> สูงสุดของวัน</li><li><i class="lg lg--avg" /> เฉลี่ยของวัน</li><li><i class="lg lg--min" /> ต่ำสุดของวัน</li><li class="legend__gap">เส้นขาด = วันที่ไม่ได้ตั้งราคา</li>
      </ul>
    </div>

    <!-- แนวโน้มน้ำหนักที่สูญเสียระหว่างขนส่งไปโรงงาน (เฉพาะผู้จัดการ/ผู้ดูแลระบบ) -->
    <div v-if="canTransport" id="c-loss" class="panel">
      <div class="panel__head">
        <ChartLabel
          tag="น้ำหาย" tone="red" title="แนวโน้มน้ำหนักที่สูญเสียระหว่างขนส่ง"
          desc="ยางที่ส่งไปโรงงานหนักหายไปเท่าไหร่ระหว่างทาง (น้ำหนักที่ส่ง − น้ำหนักที่โรงงานชั่ง) แยกเที่ยวที่ออกช่วงเช้า/บ่าย · เส้นประ = แนวโน้มว่าหายมากขึ้นหรือน้อยลง"
          :x="xName(lossGroup)" :y="lossMetric === 'lossPct' ? 'น้ำหายคิดเป็น % ของน้ำหนักที่ส่ง' : lossMetric === 'avgKg' ? 'น้ำหนักที่หายเฉลี่ยต่อเที่ยว (กก.)' : 'น้ำหนักที่หายรวม (กก.)'"
        />
        <div class="tools">
          <div class="seg seg--sm" role="group" aria-label="หน่วยที่แสดง">
            <button v-for="x in LOSS_METRICS" :key="x.v" type="button" :class="{ on: lossMetric === x.v }" :aria-pressed="lossMetric === x.v" @click="lossMetric = x.v">{{ x.label }}</button>
          </div>
          <div class="seg seg--sm" role="group" aria-label="จัดกลุ่มตาม">
            <button v-for="g in GROUPS" :key="g.v" type="button" :class="{ on: lossGroup === g.v }" :aria-pressed="lossGroup === g.v" @click="lossGroup = g.v">{{ g.label }}</button>
          </div>
          <div class="seg seg--sm" role="group" aria-label="ช่วงวันที่ของการขนส่ง">
            <button v-for="p in LOSS_PRESETS" :key="p.v" type="button" :class="{ on: lossPreset === p.v }" :aria-pressed="lossPreset === p.v" @click="applyLossPreset(p.v)">{{ p.label }}</button>
          </div>
        </div>
      </div>
      <div v-if="lossPreset === 'custom'" class="dates dates--inline">
        <label>ตั้งแต่ <input v-model="lossRange.from" type="date" :max="lossRange.to || undefined" /></label>
        <label>ถึง <input v-model="lossRange.to" type="date" :min="lossRange.from || undefined" /></label>
      </div>
      <p v-if="lossRangeError" class="warn" role="alert">{{ lossRangeError }}</p>
      <p v-if="lossError" class="state state--error" role="alert">{{ lossError }} <button type="button" @click="loadLoss">ลองใหม่</button></p>

      <div class="ltiles" :class="{ busy: lossLoading }">
        <div v-for="t in lossTiles" :key="t.key" class="ltile" :style="{ borderColor: LOSS_COLORS[t.key] }">
          <span class="tile__label">{{ t.name }} · {{ t.label }} น.</span>
          <b>{{ formatKg(t.s.lossKg) }}</b>
          <span class="ptile__sub">{{ t.s.trips }} เที่ยว · ส่ง {{ formatKg(t.s.shippedKg) }}<template v-if="t.s.lossPct != null"> · สูญเสีย {{ formatNumber(t.s.lossPct) }}%</template></span>
          <span class="verdict" :class="t.verdict.cls">{{ t.verdict.text }}<small v-if="t.verdict.cls !== 'none'"> ({{ t.metricName }})</small></span>
        </div>
      </div>

      <p v-if="lossData && !lossHasData" class="state">ไม่มีเที่ยวขนส่งในช่วงที่เลือก</p>
      <LossTrendChart v-else-if="lossData" :series="lossData.series" :windows="lossData.windows" :metric="lossMetric" :group-by="lossData.range.groupBy" :class="{ busy: lossLoading }" />
      <p v-else-if="lossLoading" class="state">กำลังโหลด…</p>
      <ul v-if="lossHasData" class="legend" aria-hidden="true">
        <li><i class="lg" style="background: #d97706" /> ช่วงเช้า 06:00 – 12:00</li>
        <li><i class="lg" style="background: #2563eb" /> ช่วงบ่าย 13:00 – 18:00</li>
        <li class="legend__gap">เส้นประ = แนวโน้ม · วัน/ช่วงที่ไม่มีเที่ยวถูกข้าม ไม่นับเป็น 0<template v-if="lossData?.otherTrips"> · มี {{ lossData.otherTrips }} เที่ยวที่ออกนอกสองช่วงเวลา จึงไม่อยู่ในกราฟ</template></li>
      </ul>
    </div>

    <div class="two">
      <div id="c-cust" class="panel">
        <div class="panel__head">
          <ChartLabel tag="ลูกค้า" tone="slate" title="ยอดรับซื้อรายลูกค้า (10 อันดับแรก)" desc="ลูกค้ารายไหนขายยางให้ร้านมากที่สุด เรียงจากมากไปน้อย · คลิกเพื่อให้กราฟ “ยอดรับซื้อ” ด้านบนแสดงเฉพาะลูกค้ารายนั้น" />
        </div>
        <BarList :items="customerItems" :format="formatMoney" selectable :active-key="customer" @select="pick" />
      </div>
      <div id="c-prod" class="panel">
        <div class="panel__head"><ChartLabel tag="สินค้า" tone="slate" title="ยอดรับซื้อตามเกรดสินค้า" desc="ยางแต่ละเกรดคิดเป็นเงินเท่าไหร่ในช่วงที่เลือก (ตัวเลขใต้ชื่อ = น้ำหนักสุทธิ)" /></div>
        <BarList :items="productItems" :format="formatMoney" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.rep { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.head { padding-top: 16px; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }
h2 { font-size: 15px; font-weight: 700; color: var(--slate-900); }

.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: var(--radius-md); background: rgba(255, 255, 255, .75); border: 1px solid var(--slate-200); }
.seg button { padding: 7px 13px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-600); }
.seg button:hover:not(.on) { background: var(--slate-100); }
.seg button.on { background: var(--blue-600); color: #fff; box-shadow: var(--shadow-blue); }
.seg--sm button { padding: 5px 10px; font-size: 11px; }
.dates { display: flex; flex-wrap: wrap; gap: 10px; }
.dates label { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--slate-600); }
.dates input { height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--slate-200); background: rgba(255, 255, 255, .85); font-size: 12px; color: var(--slate-800); }
.warn { font-size: 12px; font-weight: 600; color: #dc2626; margin-top: -6px; }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; transition: opacity .15s; }
.tiles.busy, .busy { opacity: .6; }
.tile { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: var(--radius-md); background: rgba(255, 255, 255, .8); border: 1px solid #fff; }
.tile--skeleton { color: var(--slate-500); font-size: 13px; }
.tile__label { font-size: 12px; font-weight: 600; color: var(--slate-500); }
.tile b { font-size: 21px; font-weight: 800; letter-spacing: -.3px; color: var(--slate-900); }
.tile__delta { font-size: 12px; font-weight: 700; }
.tile__delta small { font-weight: 500; color: var(--slate-500); margin-left: 2px; }
.tile__delta.up { color: var(--green-700); }
.tile__delta.down { color: var(--red-700); }

.panel { padding: 16px; border-radius: var(--radius-md); background: rgba(255, 255, 255, .8); border: 1px solid #fff; min-width: 0; }
.panel__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 9999px; background: var(--blue-50); border: 1px solid var(--blue-100); color: var(--blue-700); font-size: 12px; font-weight: 600; }
.hint { font-size: 11px; color: var(--slate-500); }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; padding-bottom: 8px; }
.state { text-align: center; color: var(--slate-500); font-size: 13px; padding: 48px 0; }
.state--error { color: #dc2626; padding: 12px 0; }
.state button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }

.sel select { height: 32px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--slate-200); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-700); }
.dates--inline { margin-bottom: 10px; }
.ptiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 14px; transition: opacity .15s; }
.ptile { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--slate-50); border-left: 4px solid var(--slate-300); }
.ptile--avg { border-color: #2563eb; } .ptile--min { border-color: #d97706; } .ptile--max { border-color: #16a34a; }
.ptile b { font-size: 19px; font-weight: 800; letter-spacing: -.3px; color: var(--slate-900); }
.ptile b small { font-size: 11px; font-weight: 500; color: var(--slate-500); }
.ptile__sub { font-size: 11px; color: var(--slate-500); }
.ltiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 14px; transition: opacity .15s; }
.ltile { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--slate-50); border-left: 4px solid var(--slate-300); }
.ltile b { font-size: 19px; font-weight: 800; letter-spacing: -.3px; color: var(--slate-900); }
.verdict { margin-top: 4px; font-size: 12px; font-weight: 700; }
.verdict small { font-weight: 500; color: var(--slate-500); }
.verdict.up { color: var(--red-700); } .verdict.down { color: var(--green-700); } .verdict.flat { color: var(--slate-600); } .verdict.none { color: var(--slate-400); font-weight: 500; }
.jump { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; font-size: 11px; color: var(--slate-500); }
.jump button { padding: 3px 10px; border-radius: 9999px; border: 1px solid var(--slate-200); background: rgba(255, 255, 255, .8); font-size: 11px; font-weight: 600; color: var(--slate-600); }
.jump button:hover { background: var(--blue-50); color: var(--blue-700); border-color: var(--blue-100); }
.exp { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--slate-200); display: flex; flex-direction: column; gap: 10px; }
.pt--in { border-color: #16a34a; } .pt--out { border-color: #d97706; } .pt--net { border-color: #2563eb; } .pt--loss { border-color: #dc2626; } .pt--kg { border-color: var(--slate-300); }
.panel { scroll-margin-top: 12px; }
.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 10px 0 0; padding: 0; font-size: 11px; color: var(--slate-500); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.lg { width: 14px; height: 3px; border-radius: 2px; }
.lg--max { background: #16a34a; } .lg--avg { background: #2563eb; height: 4px; } .lg--min { background: #d97706; }
@media (max-width: 700px) { .rep { padding: 16px; } h1 { font-size: 21px; } }
@media (prefers-reduced-motion: reduce) { .tiles { transition: none; } }
</style>

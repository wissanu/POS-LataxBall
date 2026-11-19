<script setup>
// ประเมินราคา — คำนวณความคุ้มค่าของการรับซื้อยางก้อนถ้วยด้วยสูตร P → A → B, น้ำหนักสูญเสีย L, ค่าใช้จ่ายคงที่ F, กำไรเป้าหมาย M
//  1) เลือกวัน (ย้อนหลังได้ทุกวัน) → ดึงยางที่รับซื้อวันนั้นจาก Order List แยกตามสินค้า → ติ๊กเลือกสินค้า → น้ำหนัก W และราคาซื้อเฉลี่ย A ถูกใส่ช่องให้
//     (ดึงอัตราสูญเสียจากเที่ยวขนส่ง และค่าใช้จ่ายของวันนั้นมาใส่ได้ด้วยปุ่ม) — หรือจะพิมพ์ตัวเลขเองทั้งหมดก็ได้ · ทุกช่องแก้ทับได้
//  2) ผลลัพธ์ + กราฟคำนวณใหม่ทันทีทุกครั้งที่ช่องใดเปลี่ยน · คลิกบนกราฟ L / W เพื่อตั้งค่าช่องกรอก
// สูตรทั้งหมดอยู่ที่ utils/estimate.js
import { computed, onMounted, ref, watch } from 'vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import EstimateLineChart from '@/components/EstimateLineChart.vue'
import EstimateTornado from '@/components/EstimateTornado.vue'
import EstimateWaterfall from '@/components/EstimateWaterfall.vue'
import { reportService } from '@/services/reportService'
import { financeService } from '@/services/financeService'
import { transportService } from '@/services/transportService'
import { useAuthStore } from '@/stores/auth'
import { bangkokDate, formatThaiDate } from '@/utils/dates'
import { estimate, curveByLoss, curveByVolume, curveByBuyPrice, sensitivity, waterfall, round2 } from '@/utils/estimate'
import { formatMoney, formatNumber, sanitizeDecimal, toNumber } from '@/utils/format'
import { getErrorMessage } from '@/services/http'

const auth = useAuthStore()
const panelOpen = ref(true) // แผง "ขายส่งรายวัน (ฟ้าปราณี)" ย่อ/ขยาย
const canFinance = computed(() => auth.can('transport.read')) // ค่าใช้จ่าย/ขนส่งต้องมีสิทธิ์การขนส่ง

// ---------- ช่องกรอก (เก็บเป็นข้อความ) ----------
const f = ref({ P: '', drc: '55', step: '0.5', spread: '3', A: '', W: '', L: '', F: '', M: '' })
const dec = (v) => sanitizeDecimal(v, 2)
const n = (k) => toNumber(f.value[k])

// ---------- ข้อมูลของวันที่เลือก (จาก Order List) ----------
const today = bangkokDate()
const date = ref(today)
const loading = ref(false)
const loadError = ref('')
const products = ref([]) // [{ key, name, total, netKg, avg }]
const picked = ref(new Set())
const dayInfo = ref(null) // { lossPct, trips, expense: { labor, transport, other, total } } — ถ้ามีสิทธิ์
const filledFrom = ref('') // ข้อความบอกว่า W/A มาจากข้อมูลวันไหน

async function loadDay() {
  loading.value = true; loadError.value = ''; dayInfo.value = null
  const d = date.value
  try {
    const ov = await reportService.overview({ from: d, to: d, groupBy: 'day' })
    if (d !== date.value) return // เลือกวันใหม่ระหว่างรอ
    products.value = (ov.byProduct ?? []).filter((p) => p.netKg > 0).map((p) => ({ ...p, avg: p.total / p.netKg }))
    picked.value = new Set(products.value.map((p) => p.key))
    applyPicked()
  } catch (e) {
    products.value = []; picked.value = new Set(); filledFrom.value = ''
    loadError.value = getErrorMessage(e, 'โหลดข้อมูลวันนั้นไม่สำเร็จ')
  } finally { loading.value = false }
  if (!canFinance.value) return
  // ข้อมูลเสริม (ไม่บังคับ): อัตราสูญเสียจากเที่ยวขนส่ง + ค่าใช้จ่ายของวัน
  const [tr, fin] = await Promise.allSettled([transportService.list({ from: d, to: d, pageSize: 100 }), financeService.daily(d)])
  if (d !== date.value) return
  const info = {}
  if (tr.status === 'fulfilled' && tr.value.summary?.trips > 0) info.loss = { pct: tr.value.summary.lossPct, trips: tr.value.summary.trips, kg: tr.value.summary.shippedKg }
  if (fin.status === 'fulfilled') { const x = fin.value; const tot = (x.laborCost || 0) + (x.transportCost || 0) + (x.otherCost || 0); if (tot > 0) info.expense = { labor: x.laborCost, transport: x.transportCost, other: x.otherCost, total: tot } }
  dayInfo.value = info
}
// เลือกสินค้า → W = น้ำหนักรวม · A = ราคาซื้อเฉลี่ยถ่วงน้ำหนัก (ยอดเงิน ÷ น้ำหนัก)
function applyPicked() {
  const sel = products.value.filter((p) => picked.value.has(p.key))
  const kg = sel.reduce((a, p) => a + p.netKg, 0)
  const tot = sel.reduce((a, p) => a + p.total, 0)
  if (kg > 0) { f.value.W = String(round2(kg)); f.value.A = String(round2(tot / kg)); filledFrom.value = `${formatThaiDate(date.value)} · ${sel.length} สินค้า` } else filledFrom.value = ''
}
function togglePick(p) { const s = new Set(picked.value); s.has(p.key) ? s.delete(p.key) : s.add(p.key); picked.value = s; applyPicked() }
const allOn = computed(() => products.value.length > 0 && picked.value.size === products.value.length)
function toggleAll() { picked.value = allOn.value ? new Set() : new Set(products.value.map((p) => p.key)); applyPicked() }
function useLoss() { f.value.L = String(round2(dayInfo.value.loss.pct)) }
function useExpense() { f.value.F = String(round2(dayInfo.value.expense.total)) }
watch(date, loadDay)
onMounted(loadDay)

// ---------- คำนวณ ----------
const e = computed(() => estimate({ P: n('P'), drc: n('drc') / 100, step: n('step'), spread: n('spread'), A: n('A'), W: n('W'), L: n('L') / 100, F: n('F'), M: n('M') }))
const ready = computed(() => e.value.W > 0 && e.value.A > 0)
const pct = (v) => (v == null ? '–' : `${formatNumber(v * 100)}%`)
const kgf = (v) => (v == null ? '–' : `${formatNumber(v)} กก.`)
const thb = (v) => (v == null ? '–' : `${v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`)

const verdict = computed(() => {
  const v = e.value
  if (!ready.value) return { cls: 'idle', title: 'กรอกข้อมูลเพื่อประเมิน', text: 'เลือกวันที่ด้านบนเพื่อดึงข้อมูลการรับซื้อ หรือกรอก น้ำหนักซื้อ (W) และราคาซื้อ (A) เอง' }
  if (v.verdict === 'profit') return { cls: 'ok', title: 'คุ้มค่า — มีกำไร', text: `กำไรสุทธิ ${thb(v.net)} บาท/วัน (${formatNumber(v.netKg)} บาท/กก.)` }
  if (v.verdict === 'loss') return { cls: 'bad', title: 'ขาดทุน', text: `ขาดทุนสุทธิ ${thb(-v.net)} บาท/วัน (${formatNumber(Math.abs(v.netKg))} บาท/กก.)` }
  return { cls: 'idle', title: 'เสมอตัว', text: 'กำไรสุทธิประมาณ 0 บาท' }
})
// คำแนะนำเรื่องราคา: A_max เทียบกับ A ที่ใช้
const advice = computed(() => {
  const v = e.value
  if (!ready.value || v.d == null) return null
  const goal = v.M > 0 ? `เพื่อให้ได้กำไร ${formatNumber(v.M)} บาท/กก.` : 'เพื่อไม่ขาดทุนสุทธิ'
  if (v.d > 0.005) return { cls: 'bad', text: `ควรหักราคารับซื้อลง ${formatNumber(v.d)} บาท/กก. ${goal} — ราคารับซื้อสูงสุด ${formatNumber(v.aMax)} บาท/กก.${v.step > 0 ? ` (ตั้งจริงปัดลงเป็น ${formatNumber(v.aMaxStep)})` : ''}` }
  return { cls: 'ok', text: `ราคา ${formatNumber(v.A)} ยังอยู่ในเกณฑ์ ${goal} — ขึ้นราคาได้อีกไม่เกิน ${formatNumber(-v.d)} บาท/กก. (ราคาสูงสุด ${formatNumber(v.aMax)})` }
})
const volAdvice = computed(() => {
  const v = e.value
  if (!ready.value) return ''
  if (v.wStar == null) return 'กำไรขั้นต้นต่อกก. ≤ 0 — ไม่ว่าจะซื้อกี่กิโลก็ไม่คุ้มค่าใช้จ่ายคงที่'
  if (v.F <= 0) return 'ไม่มีค่าใช้จ่ายคงที่'
  return v.W >= v.wStar ? `ซื้อ ${formatNumber(v.W)} กก. เกินจุดคุ้มทุน (${formatNumber(v.wStar)} กก.) แล้ว ${formatNumber(v.W - v.wStar)} กก.` : `ยังขาดอีก ${formatNumber(v.wStar - v.W)} กก. จึงจะคุ้มค่าใช้จ่ายคงที่`
})
const lossAdvice = computed(() => {
  const v = e.value
  if (!ready.value) return ''
  if (v.lStar <= 0) return 'ส่วนต่างราคา ≤ 0 — ขาดทุนขั้นต้นตั้งแต่ยังไม่สูญเสีย'
  return v.L > v.lStar ? `สูญเสีย ${pct(v.L)} เกิน L* (${pct(v.lStar)}) — ขาดทุนตั้งแต่ขั้นต้น` : v.L > (v.lStar2 ?? 0) ? `สูญเสีย ${pct(v.L)} ยังไม่ขาดทุนขั้นต้น แต่เกิน L** (${pct(v.lStar2)}) — ไม่พอครอบคลุมค่าใช้จ่ายคงที่` : `สูญเสีย ${pct(v.L)} ยังต่ำกว่าเพดานที่ขาดทุนสุทธิ (${pct(v.lStar2)})`
})

// ---------- กราฟ ----------
const cLoss = computed(() => (ready.value ? curveByLoss(e.value) : []))
const cVol = computed(() => (ready.value ? curveByVolume(e.value) : []))
const cBuy = computed(() => (ready.value ? curveByBuyPrice(e.value) : []))
const tornado = computed(() => (ready.value ? sensitivity(e.value) : []))
const fall = computed(() => (ready.value ? waterfall(e.value) : []))
const lossMarks = computed(() => [
  { x: e.value.L, label: `L ปัจจุบัน ${pct(e.value.L)}`, color: '#1d4ed8' },
  ...(e.value.lStar2 != null && e.value.lStar2 > 0 ? [{ x: e.value.lStar2, label: `คุ้มสุทธิ L** ${pct(e.value.lStar2)}`, color: '#dc2626' }] : []),
  ...(e.value.lStar != null ? [{ x: e.value.lStar, label: `คุ้มขั้นต้น L* ${pct(e.value.lStar)}`, color: '#d97706' }] : []),
])
const volMarks = computed(() => [
  { x: e.value.W, label: `W ปัจจุบัน ${formatNumber(e.value.W)}`, color: '#1d4ed8' },
  ...(e.value.wStar != null && e.value.F > 0 ? [{ x: e.value.wStar, label: `คุ้มทุน W* ${formatNumber(e.value.wStar)}`, color: '#dc2626' }] : []),
])
const buyMarks = computed(() => [
  { x: e.value.A, label: `ราคาตลาด A ${formatNumber(e.value.A)}`, color: '#1d4ed8' },
  ...(e.value.aMax != null ? [{ x: e.value.aMax, label: `A สูงสุด ${formatNumber(e.value.aMax)}`, color: '#dc2626' }] : []),
])
const pickL = (x) => { f.value.L = String(round2(Math.max(0, x * 100))) }
const pickW = (x) => { f.value.W = String(Math.max(1, Math.round(x))); filledFrom.value = '' }

// ---------- วิธีคิด (แทนค่าให้ดูทีละบรรทัด) ----------
const steps = computed(() => {
  const v = e.value
  if (!ready.value) return []
  const r = (x) => formatNumber(x)
  return [
    ...(v.aMarket != null ? [{ t: 'ราคาตลาดประเมินจากโรงงาน', f: 'ปัดลง(P × DRC)', s: `ปัดลง(${r(v.P)} × ${r(v.drc)}) = ปัดลง(${r(v.flesh)}) ${v.step > 0 ? `ทีละ ${v.step}` : ''}`, v: `${r(v.aMarket)} บาท/กก.` }] : []),
    { t: 'ราคาขายหลังเทิร์น B', f: 'B = A + ส่วนต่าง', s: `${r(v.A)} + ${r(v.S)}`, v: `${r(v.B)} บาท/กก.` },
    { t: 'น้ำหนักที่หาย', f: 'W × L', s: `${r(v.W)} × ${r(v.L)}`, v: kgf(v.lostKg) },
    { t: 'น้ำหนักที่เหลือไปขาย', f: 'W × (1 − L)', s: `${r(v.W)} × (1 − ${r(v.L)})`, v: kgf(v.wAfter) },
    { t: 'ต้นทุนซื้อรวม', f: 'W × A', s: `${r(v.W)} × ${r(v.A)}`, v: `${r(v.cost)} บาท` },
    { t: 'รายรับรวม', f: 'W × (1 − L) × B', s: `${r(v.W)} × (1 − ${r(v.L)}) × ${r(v.B)}`, v: `${r(v.revenue)} บาท` },
    { t: 'กำไรขั้นต้น/กก.', f: '(1 − L) × B − A  = S − B × L', s: `(1 − ${r(v.L)}) × ${r(v.B)} − ${r(v.A)}`, v: `${r(v.grossKg)} บาท/กก.` },
    { t: 'กำไรสุทธิ/วัน', f: 'W × กำไรขั้นต้น/กก. − F', s: `${r(v.W)} × ${r(v.grossKg)} − ${r(v.F)}`, v: `${r(v.net)} บาท` },
    { t: 'กำไรสุทธิ/กก.', f: 'กำไรขั้นต้น/กก. − F ÷ W', s: `${r(v.grossKg)} − ${r(v.F)} ÷ ${r(v.W)}`, v: `${r(v.netKg)} บาท/กก.` },
    { t: 'L* (เสมอตัวขั้นต้น)', f: 'S ÷ B', s: `${r(v.B - v.A)} ÷ ${r(v.B)}`, v: pct(v.lStar) },
    { t: 'L** (เสมอตัวสุทธิ)', f: '(S − F ÷ W) ÷ B', s: `(${r(v.B - v.A)} − ${r(v.F)} ÷ ${r(v.W)}) ÷ ${r(v.B)}`, v: pct(v.lStar2) },
    { t: 'ปริมาณซื้อขั้นต่ำ W*', f: 'F ÷ กำไรขั้นต้น/กก.', s: `${r(v.F)} ÷ ${r(v.grossKg)}`, v: v.wStar == null ? 'ไม่คุ้ม' : kgf(v.wStar) },
    { t: 'ราคารับซื้อสูงสุด A_max', f: 'B × (1 − L) − F ÷ W − M', s: `${r(v.B)} × (1 − ${r(v.L)}) − ${r(v.F)} ÷ ${r(v.W)} − ${r(v.M)}`, v: `${r(v.aMax)} บาท/กก.` },
    { t: 'ต้องหักราคาลง d', f: 'A − A_max', s: `${r(v.A)} − ${r(v.aMax)}`, v: `${r(v.d)} บาท/กก.` },
  ]
})
</script>

<template>
  <section class="ep glass">
    <header class="head">
      <div>
        <h1>ประเมินราคา</h1>
        <p>คำนวณความคุ้มค่าของการรับซื้อ — กำไรต่อวัน จุดเสมอตัว และราคารับซื้อสูงสุด · กราฟเปลี่ยนตามตัวเลขทุกครั้ง</p>
      </div>
    </header>

    <div class="scroll">
      <!-- แผงเดียว: 1) เลือกวันและสินค้า · 2) ตัวเลขที่ใช้คำนวณ · 3) ผลลัพธ์ — ย่อ/ขยายได้ -->
      <section class="card panel" aria-label="ขายส่งรายวัน (ฟ้าปราณี)">
        <button type="button" class="panel__head" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen">
          <span class="chev" :class="{ up: panelOpen }">▸</span>
          <b>ขายส่งรายวัน (ฟ้าปราณี)</b>
          <span v-if="!panelOpen" class="panel__sum" :class="verdict.cls">{{ ready ? `${verdict.title} · ${thb(e.net)} บาท/วัน` : verdict.title }}</span>
        </button>
        <div v-show="panelOpen" class="panel__body">
      <!-- 1) ดึงข้อมูลจากวันที่ทำรายการ -->
      <section class="sub">
        <div class="card__h">
          <h2>1) เลือกวันและสินค้า <small>ดึงจากใบรับซื้อที่ยืนยันแล้วในหน้า Order List — หรือข้ามไปกรอกเองได้</small></h2>
          <label class="date"><span>วันที่</span><input v-model="date" type="date" :max="today" /></label>
          <button v-if="date !== today" type="button" class="lnk" @click="date = today">วันนี้</button>
        </div>
        <p v-if="loading" class="muted">กำลังโหลด…</p>
        <p v-else-if="loadError" class="err" role="alert">{{ loadError }} <button type="button" class="lnk" @click="loadDay">ลองใหม่</button></p>
        <p v-else-if="!products.length" class="muted">วันที่ {{ formatThaiDate(date) }} ไม่มีใบรับซื้อที่ยืนยันแล้ว — เลือกวันอื่น หรือกรอกตัวเลขเองด้านล่าง</p>
        <template v-else>
          <div class="plist" role="group" aria-label="สินค้าที่รับซื้อ">
            <label class="all"><input type="checkbox" :checked="allOn" @change="toggleAll" /> เลือกทั้งหมด</label>
            <label v-for="p in products" :key="p.key" class="pchip" :class="{ on: picked.has(p.key) }">
              <input type="checkbox" :checked="picked.has(p.key)" @change="togglePick(p)" />
              <span class="pchip__n">{{ p.name }}</span>
              <span class="pchip__v">{{ formatNumber(p.netKg) }} กก. · เฉลี่ย {{ formatNumber(p.avg) }}/กก.</span>
            </label>
          </div>
          <p v-if="filledFrom" class="ok-note"><AppIcon name="check" :size="13" /> ใส่ น้ำหนักซื้อ (W) และราคาซื้อเฉลี่ย (A) ให้แล้วจาก {{ filledFrom }} — แก้ทับได้</p>
        </template>
        <div v-if="dayInfo && (dayInfo.loss || dayInfo.expense)" class="quick">
          <button v-if="dayInfo.loss" type="button" @click="useLoss"><AppIcon name="truck" :size="13" /> ใช้อัตราสูญเสียขนส่งวันนั้น {{ formatNumber(dayInfo.loss.pct) }}% ({{ dayInfo.loss.trips }} เที่ยว)</button>
          <button v-if="dayInfo.expense" type="button" @click="useExpense"><AppIcon name="wallet" :size="13" /> ใช้ค่าใช้จ่ายของวันนั้น {{ formatMoney(dayInfo.expense.total) }} บาท</button>
        </div>
      </section>

      <!-- 2) ตัวแปร -->
      <section class="sub">
        <div class="card__h"><h2>2) ตัวเลขที่ใช้คำนวณ <small>พิมพ์แก้ได้ทุกช่อง</small></h2></div>
        <div class="grid">
          <BaseInput v-model="f.P" label="P · ราคาโรงงานยางแห้ง 100% (บาท/กก.)" inputmode="decimal" placeholder="เช่น 69" :format="dec" />
          <BaseInput v-model="f.drc" label="DRC ที่ประเมิน (%)" inputmode="decimal" placeholder="55" :format="dec" />
          <label class="sel"><span>ปัดราคาลงทีละ (r)</span>
            <select v-model="f.step"><option value="0.5">0.50 บาท</option><option value="1">1 บาท</option><option value="0">ไม่ปัด</option></select>
          </label>
          <div class="withbtn">
            <BaseInput v-model="f.A" label="A · ราคาซื้อจากชาวสวน (บาท/กก.สด)" inputmode="decimal" placeholder="เช่น 37.50" :format="dec" />
            <button v-if="e.aMarket != null" type="button" class="lnk" @click="f.A = String(e.aMarket)">ใช้ราคาประเมินจาก P = {{ formatNumber(e.aMarket) }}</button>
          </div>
          <BaseInput v-model="f.spread" label="ส่วนต่างที่ร้านใหญ่การันตี → B = A + (บาท/กก.)" inputmode="decimal" placeholder="3" :format="dec" />
          <BaseInput v-model="f.W" label="W · น้ำหนักซื้อเข้า (กก.สด)" inputmode="decimal" placeholder="เช่น 3000" :format="dec" />
          <BaseInput v-model="f.L" label="L · น้ำหนักที่หายหลังเทิร์น (%)" inputmode="decimal" placeholder="เช่น 4" :format="dec" />
          <BaseInput v-model="f.F" label="F · ค่าใช้จ่ายคงที่ (บาท/วัน)" inputmode="decimal" placeholder="เช่น 2500" :format="dec" />
          <BaseInput v-model="f.M" label="M · กำไรเป้าหมาย (บาท/กก.สด)" inputmode="decimal" placeholder="เช่น 1" :format="dec" />
        </div>
      </section>

      <!-- 3) ผลลัพธ์ -->
      <section class="sub" aria-live="polite">
        <div class="card__h"><h2>3) ผลลัพธ์</h2></div>
        <div class="verdict" :class="verdict.cls"><b>{{ verdict.title }}</b><span>{{ verdict.text }}</span></div>
        <template v-if="ready">
          <div class="tiles">
            <div class="tile tile--hi" :class="e.net < 0 ? 'neg' : 'pos'"><small>กำไรสุทธิ/วัน</small><b>{{ thb(e.net) }}</b><em>บาท</em></div>
            <div class="tile"><small>กำไรสุทธิ/กก.</small><b>{{ thb(e.netKg) }}</b><em>บาท/กก.สด</em></div>
            <div class="tile"><small>กำไรขั้นต้น/กก. = (1−L)B−A</small><b>{{ thb(e.grossKg) }}</b><em>รวม {{ thb(e.gross) }} บาท</em></div>
            <div class="tile"><small>ราคาขาย B = A + {{ formatNumber(e.S) }}</small><b>{{ formatNumber(e.B) }}</b><em>บาท/กก.</em></div>
            <div class="tile"><small>น้ำหนักที่เหลือขาย</small><b>{{ formatNumber(e.wAfter) }}</b><em>หายไป {{ formatNumber(e.lostKg) }} กก.</em></div>
            <div class="tile"><small>ต้นทุนซื้อ → รายรับ</small><b>{{ formatNumber(e.cost) }}</b><em>→ {{ formatNumber(e.revenue) }} บาท</em></div>
          </div>
          <div class="tiles tiles--be">
            <div class="tile"><small>L* สูญเสียสูงสุดก่อนขาดทุนขั้นต้น</small><b>{{ pct(e.lStar) }}</b><em>S ÷ B</em></div>
            <div class="tile"><small>L** สูญเสียสูงสุดก่อนขาดทุนสุทธิ</small><b>{{ pct(e.lStar2) }}</b><em>รวมค่าใช้จ่ายคงที่</em></div>
            <div class="tile"><small>W* ซื้อขั้นต่ำให้คุ้ม F</small><b>{{ e.wStar == null ? 'ไม่คุ้ม' : kgf(e.wStar) }}</b><em>F ÷ กำไรขั้นต้น/กก.</em></div>
            <div class="tile tile--hi"><small>A สูงสุดที่ยังได้กำไร M</small><b>{{ formatNumber(e.aMax) }}</b><em>{{ e.d > 0.005 ? `หักลง ${formatNumber(e.d)} บาท/กก.` : `ขึ้นได้อีก ${formatNumber(-e.d)} บาท/กก.` }}</em></div>
          </div>
          <p v-if="advice" class="advice" :class="advice.cls">{{ advice.text }}</p>
        </template>
      </section>
        </div>
      </section>

      <!-- 4) กราฟ -->
      <template v-if="ready">
        <div class="charts">
          <section class="card">
            <div class="card__h"><h2>กำไรสุทธิ/วัน ตามอัตราสูญเสีย <small>คลิกกราฟเพื่อตั้งค่า L</small></h2></div>
            <EstimateLineChart :points="cLoss" :current="{ x: e.L, y: e.net }" :markers="lossMarks" :x-fmt="(v) => `${formatNumber(v * 100)}%`" :y-fmt="(v) => formatNumber(Math.round(v))" x-label="สูญเสีย L" y-label="กำไร" @pick="pickL" />
            <p class="cap">{{ lossAdvice }}</p>
          </section>
          <section class="card">
            <div class="card__h"><h2>กำไรสุทธิ/วัน ตามปริมาณที่ซื้อ <small>คลิกกราฟเพื่อตั้งค่า W</small></h2></div>
            <EstimateLineChart :points="cVol" :current="{ x: e.W, y: e.net }" :markers="volMarks" :x-fmt="(v) => formatNumber(Math.round(v))" :y-fmt="(v) => formatNumber(Math.round(v))" x-label="ซื้อ W (กก.)" y-label="กำไร" @pick="pickW" />
            <p class="cap">{{ volAdvice }}</p>
          </section>
          <section class="card">
            <div class="card__h"><h2>กำไรสุทธิ/กก. ตามราคารับซื้อที่ตั้ง <small>ราคาขาย B คงที่</small></h2></div>
            <EstimateLineChart :points="cBuy" :current="{ x: e.A, y: e.netKg }" :markers="buyMarks" :refs="e.M > 0 ? [{ y: e.M, label: `เป้า M ${formatNumber(e.M)}`, color: '#d97706' }] : []" :x-fmt="(v) => formatNumber(v)" :y-fmt="(v) => formatNumber(v)" x-label="ราคารับซื้อ (บาท/กก.)" y-label="กำไร/กก." :clickable="false" />
            <p class="cap">จุดที่เส้นตัดเส้นเป้า M = ราคารับซื้อสูงสุด A_max · ซื้อแพงกว่านั้นกำไรต่ำกว่าเป้า</p>
          </section>
          <section class="card">
            <div class="card__h"><h2>เงินหายไปไหน <small>น้ำตกกำไร (บาท/วัน)</small></h2></div>
            <EstimateWaterfall :steps="fall" />
          </section>
          <section class="card card--wide">
            <div class="card__h"><h2>ปัจจัยไหนกระทบกำไรมากที่สุด <small>ขยับทีละปัจจัย ราคา ±1 บาท · สูญเสีย ±1 จุด % · ปริมาณ/ค่าใช้จ่าย ±10%</small></h2></div>
            <EstimateTornado :rows="tornado" />
          </section>
        </div>

        <details class="card how">
          <summary>วิธีคิด — แทนค่าทีละบรรทัด</summary>
          <table>
            <thead><tr><th>รายการ</th><th>สูตร</th><th>แทนค่า</th><th class="r">ผล</th></tr></thead>
            <tbody><tr v-for="s in steps" :key="s.t"><td>{{ s.t }}</td><td>{{ s.f }}</td><td>{{ s.s }}</td><td class="r"><b>{{ s.v }}</b></td></tr></tbody>
          </table>
        </details>
      </template>
    </div>
  </section>
</template>

<style scoped>
.ep { flex: 1; min-width: 0; min-height: 0; padding: 20px; display: flex; flex-direction: column; overflow: hidden; }
.head { flex: none; padding-top: 16px; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }
.scroll { flex: 1; min-height: 0; overflow: auto; padding: 14px 2px 20px; display: flex; flex-direction: column; gap: 14px; }
.card { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg, 14px); padding: 14px 16px; }
.card__h { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 10px; }
.card__h h2 { flex: 1; min-width: 200px; font-size: 14px; font-weight: 800; color: var(--slate-900); }
.card__h h2 small { font-size: 11px; font-weight: 500; color: var(--slate-500); margin-left: 4px; }
.date { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-500); }
.date input, .sel select { height: 36px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font: inherit; font-size: 13px; color: var(--slate-800); }
.lnk { font-size: 12px; font-weight: 600; color: var(--blue-700); text-align: left; }
.lnk:hover { text-decoration: underline; }
.muted { font-size: 13px; color: var(--slate-500); } .err { font-size: 13px; color: var(--red-700); }
.plist { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.all { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--slate-600); margin-right: 4px; }
.pchip { display: inline-flex; flex-direction: column; gap: 1px; padding: 7px 12px 7px 32px; position: relative; border: 1px solid var(--slate-200); border-radius: var(--radius-md); cursor: pointer; background: #fff; }
.pchip input { position: absolute; left: 10px; top: 11px; accent-color: var(--blue-600); }
.pchip.on { background: var(--blue-50); border-color: var(--blue-100); }
.pchip__n { font-size: 13px; font-weight: 700; color: var(--slate-900); } .pchip__v { font-size: 11px; color: var(--slate-500); }
.ok-note { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--green-700); font-weight: 600; }
.quick { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.quick button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9999px; border: 1px solid var(--blue-100); background: var(--blue-50); color: var(--blue-700); font-size: 12px; font-weight: 600; }
.quick button:hover { background: var(--blue-100); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px 14px; align-items: start; }
.sel { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--slate-800); } .sel select { height: 44px; }
.withbtn { display: flex; flex-direction: column; gap: 4px; }

.verdict { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: var(--radius-md); margin-bottom: 12px; }
.verdict b { font-size: 16px; font-weight: 800; } .verdict span { font-size: 13px; }
.verdict.ok { background: var(--green-50); color: var(--green-700); border: 1px solid var(--green-100); }
.verdict.bad { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; }
.verdict.idle { background: var(--slate-50, #f8fafc); color: var(--slate-600); border: 1px solid var(--slate-200); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 10px; }
.tile { padding: 10px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 2px; }
.tile small { font-size: 11px; color: var(--slate-500); } .tile b { font-size: 18px; font-weight: 800; color: var(--slate-900); } .tile em { font-style: normal; font-size: 11px; color: var(--slate-500); }
.tile--hi { background: var(--blue-50); border-color: var(--blue-100); } .tile--hi b { color: var(--blue-700); }
.tile--hi.pos { background: var(--green-50); border-color: var(--green-100); } .tile--hi.pos b { color: var(--green-700); }
.tile--hi.neg { background: var(--red-50); border-color: #fecaca; } .tile--hi.neg b { color: var(--red-700); }
.advice { padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; line-height: 1.6; }
.advice.ok { background: var(--green-50); color: var(--green-700); } .advice.bad { background: var(--red-50); color: var(--red-700); }

.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 14px; }
.card--wide { grid-column: 1 / -1; }
.cap { margin-top: 6px; font-size: 12px; color: var(--slate-600); line-height: 1.6; }
.how summary { cursor: pointer; font-size: 14px; font-weight: 800; color: var(--slate-900); }
.how table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
.how th { text-align: left; font-size: 11px; color: var(--slate-500); padding: 4px 8px; } .how td { padding: 7px 8px; border-top: 1px solid var(--slate-100); vertical-align: top; }
.how td:nth-child(2), .how td:nth-child(3) { color: var(--slate-600); } .r { text-align: right !important; white-space: nowrap; }
.panel { padding: 0; }
.panel__head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 14px 16px; text-align: left; font-size: 15px; color: var(--slate-900); }
.panel__head b { font-weight: 800; }
.chev { display: inline-block; transition: transform .15s; color: var(--slate-500); } .chev.up { transform: rotate(90deg); }
.panel__sum { margin-left: auto; padding: 3px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: var(--slate-100); color: var(--slate-600); }
.panel__sum.ok { background: var(--green-50); color: var(--green-700); } .panel__sum.bad { background: var(--red-50); color: var(--red-700); }
.panel__body { padding: 0 16px 6px; }
.sub { padding: 14px 0; border-top: 1px solid var(--slate-100); }
</style>

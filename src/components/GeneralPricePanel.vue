<script setup>
// คำนวนราคารับซื้อ (ทั่วไป) — แผงย่อ/ขยายได้ ในหน้า "ประเมินราคา"
// โมเดลเดียวกันทั้งราคา ตาราง และกราฟ (สอดคล้องกัน):
//   รับซื้อ W กก. → น้ำหนักหายระหว่างทาง (อัตราสูญเสียน้ำ L%) → ถึงโรงงาน W×(1−L) กก. → × DRC% = เนื้อยางแห้ง → × ราคาโรงงาน F = รายได้
//   y (เนื้อยางแห้งต่อ 1 กก. ที่ซื้อ) = (1 − L) × DRC     ร้านจ่ายได้สูงสุด = F × y − ต้นทุนคงที่ต่อ กก. − กำไรที่ต้องการ → ปัดลง → "ตั้งราคาประมาณ"
// ใส่แค่ราคาโรงงาน (F) ก็ได้คำตอบ · ช่องอื่นเว้นว่างได้ · สูตรอยู่ที่ src/lib/rubber-price (pure functions + Vitest)
// ไม่คุ้มจะเตือนเสมอ ไม่ปรับราคาขึ้นให้เงียบ ๆ · ปรับที่ราคาต่อ กก. ตามเกรดเท่านั้น ไม่ปรับตาชั่ง
import { computed, reactive, ref } from 'vue'
import BaseInput from '@/components/BaseInput.vue'
import AppIcon from '@/components/AppIcon.vue'
import EstimateLineChart from '@/components/EstimateLineChart.vue'
import {
  DEFAULT_PARAMS, GRADES, calibrateYield, cashNeeded, compareToMarket, fixedPerKg, priceBoard, quoteRange, simulateLotFromWeights,
  suggestBuyPrice, validateParams, yieldFromDrcLoss,
} from '@/lib/rubber-price'
import { formatMoney, formatNumber, sanitizeDecimal, toNumber } from '@/utils/format'

const openPanel = ref(false)
const dec = (v) => sanitizeDecimal(v, 3)
const n = (v) => toNumber(v)
const filled = (v) => v !== '' && v != null
const opt = (v) => (filled(v) ? n(v) : null) // ว่าง = ไม่ใช้
const r1 = (x) => String(Math.round(x * 100) / 100)

// ---------- ค่าเริ่มต้นสมมติของแต่ละเกรด: DRC ที่โรงงานวัดได้ และอัตราสูญเสียน้ำระหว่างทาง (ต้อง calibrate จากล็อตจริง) ----------
// เกรด B อ้างอิงล็อตจริง: ซื้อ 1,813.3 → โรงงานชั่ง 1,699.8 กก. (หาย ≈ 6.3%) DRC 58.7% → y ≈ 0.55
const GRADE_DRC = { 'A+': 63, A: 61.5, 'B+': 59.5, B: 58.7, 'C+': 56, C: 54.5, D: 50.5 }
const GRADE_LOSS = { 'A+': 5, A: 5.5, 'B+': 6, B: 6.3, 'C+': 7, C: 8, D: 9 }
const GRADE_DESC = { 'A+': 'แห้งหมาด สะอาดมาก', A: 'แห้งดี', 'B+': 'ค่อนข้างดี', B: 'ยางทั่วไป', 'C+': 'ค่อนข้างเปียก', C: 'อมน้ำ', D: 'อมน้ำมาก / ปนดิน' }

// ---------- ช่องกรอก: ที่ "ต้องกรอก" มีช่องเดียวคือ F · ที่เหลือเว้นว่างได้ ----------
const initial = () => ({
  F: '', margin: '', market: '',
  grade: 'B', drc: String(GRADE_DRC.B), loss: String(GRADE_LOSS.B), // 'manual' เมื่อพิมพ์ DRC/สูญเสียเอง
  fixedDay: '', expectedKg: '',
  gradeDrc: { ...GRADE_DRC }, gradeLoss: { ...GRADE_LOSS },
})
const f = reactive(initial())
const moreOpen = ref(false)
const reset = () => Object.assign(f, initial())

function pickGrade(g) { f.grade = g; f.drc = String(f.gradeDrc[g]); f.loss = String(f.gradeLoss[g]) }
const typeDrc = (v) => { f.drc = v; f.grade = 'manual' }
const typeLoss = (v) => { f.loss = v; f.grade = 'manual' }
function setGradeCell(kind, g, v) { f[kind === 'drc' ? 'gradeDrc' : 'gradeLoss'][g] = v; if (f.grade === g) (kind === 'drc' ? (f.drc = v) : (f.loss = v)) }

const yWork = computed(() => yieldFromDrcLoss(n(f.drc), n(f.loss)))
const params = computed(() => ({
  factoryPrice: n(f.F), baseYield: yWork.value, targetMargin: opt(f.margin) ?? 0,
  fixedCostPerDay: opt(f.fixedDay) ?? 0, expectedDailyKg: opt(f.expectedKg) ?? DEFAULT_PARAMS.expectedDailyKg,
  priceCap: null, priceFloor: null, priceStep: DEFAULT_PARAMS.priceStep, // ไม่มีเพดาน/ราคาพื้น/ขั้นปัดให้ตั้ง — ปัดลงทีละ 0.50 เสมอ
  marketReferencePrice: opt(f.market), marketWarnGap: DEFAULT_PARAMS.marketWarnGap,
  gradeYield: Object.fromEntries(GRADES.map((g) => [g, yieldFromDrcLoss(n(f.gradeDrc[g]), n(f.gradeLoss[g]))])), // y รายเกรด = (1 − สูญเสีย) × DRC ของเกรดนั้น
}))
const hasF = computed(() => n(f.F) > 0)
const inputIssues = computed(() => {
  const out = []
  if (!(n(f.drc) > 0 && n(f.drc) <= 100)) out.push('DRC ต้องอยู่ระหว่าง 1 ถึง 100%')
  if (!(n(f.loss) >= 0 && n(f.loss) < 100)) out.push('อัตราสูญเสียน้ำต้องอยู่ระหว่าง 0 ถึง 99%')
  return out
})
const issues = computed(() => [...inputIssues.value, ...validateParams(params.value).filter((i) => i.field !== 'baseYield' && (hasF.value || i.field !== 'factoryPrice')).map((i) => i.message)])

// ---------- ราคาอ้างอิงกลาง (ใช้ที่หัวแผงและเป็นค่าเริ่มต้นของเครื่องมือเพิ่มเติม) ----------
const res = computed(() => suggestBuyPrice(params.value, yWork.value))
const fpk = computed(() => fixedPerKg(params.value.fixedCostPerDay, params.value.expectedDailyKg))
const fixedUsed = computed(() => (params.value.fixedCostPerDay > 0 && Number.isFinite(fpk.value) ? fpk.value : 0))
const notWorth = computed(() => res.value.warnings.some((w) => w.code === 'NOT_WORTH'))
const money = (v) => (v == null || !Number.isFinite(v) ? '–' : `${v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`)
const pctOf = (y) => `${formatNumber(y * 100)}%`
const num = (v) => (v == null || !Number.isFinite(v) ? '–' : formatNumber(v))

// ---------- คำนวณรายลูกค้า: ราคาที่ควรรับซื้อ + เพดานบน (ต่อรองขึ้นได้ถึงไหน) + เพดานล่าง (เริ่มกดราคาจากตรงไหน) ----------
//   ใช้ ราคาโรงงาน / DRC / กำไรที่ต้องการ / ต้นทุนคงที่ ที่กรอกด้านบน — แต่ละเจ้าใส่ "คาดการณ์อัตราสูญเสีย (%)" ของยางเจ้านั้น (DRC เว้นว่าง = ใช้ค่าด้านบน)
//   เพดานบน = ราคาแนะนำ + ช่วงต่อรองขึ้น · ถ้าที่ราคานั้นขาดทุน → สีแดง "เพิ่มราคาไม่ได้" ·  เพดานล่าง = ราคาแนะนำ − ช่วงกดราคา (ยางไม่สม่ำเสมอ)
const room = reactive({ up: '1', down: '1' })
const custs = ref([{ name: '', loss: '', drc: '' }])
const addCust = () => custs.value.push({ name: '', loss: '', drc: '' })
const delCust = (i) => custs.value.splice(i, 1)
const custRows = computed(() => custs.value.map((c) => {
  const loss = filled(c.loss) ? n(c.loss) : n(f.loss)
  const drc = filled(c.drc) ? n(c.drc) : n(f.drc)
  const q = quoteRange(params.value, yieldFromDrcLoss(drc, loss), { up: opt(room.up) ?? 1, down: opt(room.down) ?? 1 })
  const mk = q.recommended != null && params.value.marketReferencePrice != null ? compareToMarket(q.recommended, params.value.marketReferencePrice, params.value.marketWarnGap) : null
  return { c, loss, drc, q, below: mk?.warnings[0] ?? null, notWorth: q.warnings.some((w) => w.code === 'NOT_WORTH') }
}))
const STATUS_TXT = { ok: 'ได้กำไรตามเป้า', low: 'กำไรต่ำกว่าเป้า', loss: 'ขาดทุน — เพิ่มราคาไม่ได้' }

// ---------- ราคาตามเกรด (ใช้ DRC และสูญเสียของแต่ละเกรด → สอดคล้องกับโมเดลเดียวกัน) ----------
const board = computed(() => priceBoard(params.value))
const STATUS = { ok: 'คุ้ม', capped: 'ติดเพดาน', not_worth: 'ไม่คุ้ม' }

// ---------- เครื่องมือเพิ่มเติม ----------
// ลองกับน้ำหนักจริง: ซื้อกี่ กก. → หายระหว่างทาง → โรงงานวัด DRC → ได้เงินเท่าไหร่ → กำไร/ขาดทุน
const lot = reactive({ kg: '', buy: '', loss: '', drc: '', fixed: '' })
const lotBuy = computed(() => (filled(lot.buy) ? n(lot.buy) : res.value.price ?? 0))
const lotLoss = computed(() => (filled(lot.loss) ? n(lot.loss) : n(f.loss)))
const lotDrc = computed(() => (filled(lot.drc) ? n(lot.drc) : n(f.drc)))
const lotFixed = computed(() => (filled(lot.fixed) ? n(lot.fixed) : fixedUsed.value * n(lot.kg)))
const lotOk = computed(() => hasF.value && n(lot.kg) > 0 && lotBuy.value > 0)
const lotBase = computed(() => ({ kgBought: n(lot.kg), F: params.value.factoryPrice, buyPrice: lotBuy.value, fixedCostForLot: lotFixed.value }))
const lotRes = computed(() => simulateLotFromWeights({ ...lotBase.value, lossPct: lotLoss.value, drcPct: lotDrc.value }))
const net = (loss, drc) => simulateLotFromWeights({ ...lotBase.value, lossPct: loss, drcPct: drc }).net
const range = (a, b, step) => { const out = []; for (let x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 100) / 100); return out }
const curveDrc = computed(() => range(Math.max(20, Math.floor(lotDrc.value) - 15), Math.min(80, Math.ceil(lotDrc.value) + 15), 0.5).map((x) => ({ x, y: net(lotLoss.value, x) })))
const curveLoss = computed(() => range(0, Math.max(15, Math.ceil(lotLoss.value * 2)), 0.5).map((x) => ({ x, y: net(x, lotDrc.value) })))
const markDrc = computed(() => [{ x: lotDrc.value, label: `DRC ${formatNumber(lotDrc.value)}%`, color: '#1d4ed8' }, ...(lotRes.value.breakevenDrcPct != null ? [{ x: lotRes.value.breakevenDrcPct, label: `เสมอทุน ${formatNumber(lotRes.value.breakevenDrcPct)}%`, color: '#dc2626' }] : [])])
const markLoss = computed(() => [{ x: lotLoss.value, label: `สูญเสีย ${formatNumber(lotLoss.value)}%`, color: '#1d4ed8' }, ...(lotRes.value.breakevenLossPct != null && lotRes.value.breakevenLossPct >= 0 ? [{ x: lotRes.value.breakevenLossPct, label: `เสมอทุน ${formatNumber(lotRes.value.breakevenLossPct)}%`, color: '#dc2626' }] : [])])
const pickDrc = (x) => { lot.drc = String(Math.round(x * 10) / 10) }
const pickLoss = (x) => { lot.loss = String(Math.round(x * 10) / 10) }

// เงินสดที่ต้องเตรียม
const cash = reactive({ kg: '', extra: '', buy: '' })
const cashRes = computed(() => cashNeeded({ expectedKg: n(cash.kg), sigmaKg: n(cash.extra), buyPrice: filled(cash.buy) ? n(cash.buy) : res.value.price ?? 0, z: 1 }, params.value))

// ปรับค่าจากล็อตจริง: ได้ทั้งอัตราสูญเสียน้ำ, DRC และ y
const lots = ref([{ grade: 'B', kgPurchased: '', kgFactory: '', drc: '' }])
const addLot = () => lots.value.push({ grade: 'B', kgPurchased: '', kgFactory: '', drc: '' })
const delLot = (i) => lots.value.splice(i, 1)
const calib = computed(() => calibrateYield(lots.value.map((l) => ({ grade: l.grade || undefined, kgPurchased: n(l.kgPurchased), kgFactory: n(l.kgFactory), drcPercent: n(l.drc) })), params.value))
const calibEmpty = computed(() => lots.value.every((l) => !filled(l.kgPurchased) && !filled(l.kgFactory) && !filled(l.drc)))
function applyCalib() { f.loss = r1(calib.value.weightedLossPct); f.drc = r1(calib.value.weightedDrcPct); f.grade = 'manual' }
function applyGradeCalib() { for (const [g, v] of Object.entries(calib.value.byGrade)) { f.gradeLoss[g] = r1(v.lossPct); f.gradeDrc[g] = r1(v.drcPct) } }
</script>

<template>
  <section class="card panel" aria-label="คำนวนราคารับซื้อ (ทั่วไป)">
    <button type="button" class="panel__head" :aria-expanded="openPanel" @click="openPanel = !openPanel">
      <span class="chev" :class="{ up: openPanel }">▸</span>
      <b>คำนวนราคารับซื้อ (ทั่วไป)</b>
      <span v-if="!openPanel" class="panel__sum" :class="hasF ? (notWorth ? 'bad' : 'ok') : ''">
        {{ hasF && res.price != null ? `ตั้งราคาประมาณ ${formatNumber(res.price)} บาท/กก.${notWorth ? ' · ไม่คุ้ม' : ''}` : 'ใส่ราคาโรงงานเพื่อเริ่ม' }}
      </span>
    </button>

    <div v-show="openPanel" class="panel__body">
      <!-- ① ราคาโรงงาน + สภาพยาง -->
      <section class="sub">
        <h3 class="q">ราคาโรงงานที่ DRC 100% วันนี้เท่าไหร่?</h3>
        <div class="grid ask">
          <BaseInput v-model="f.F" label="ราคาโรงงาน (บาท/กก.)" inputmode="decimal" placeholder="เช่น 72" :format="dec" />
          <BaseInput v-model="f.fixedDay" label="ต้นทุนคงที่ (บาท/วัน) เช่น ค่าแรง น้ำมัน" inputmode="decimal" placeholder="เว้นว่าง = ไม่คิด" :format="dec" />
          <BaseInput v-model="f.expectedKg" label="คาดรับซื้อ (กก./วัน) — ใช้หารต้นทุนคงที่" inputmode="decimal" :placeholder="`เว้นว่าง = ${DEFAULT_PARAMS.expectedDailyKg}`" :format="dec" />
        </div>

        <p class="sub__t">ยางที่ซื้อเป็นเกรดไหน? <span class="muted">(เลือกแล้ว DRC และอัตราสูญเสียน้ำเปลี่ยนตาม — เป็นค่าสมมติ แก้เองได้)</span></p>
        <div class="seg" role="group" aria-label="เกรดยาง">
          <button v-for="g in GRADES" :key="g" type="button" :class="{ on: f.grade === g }" :title="GRADE_DESC[g]" @click="pickGrade(g)">{{ g }}</button>
          <button type="button" :class="{ on: f.grade === 'manual' }" @click="f.grade = 'manual'">กรอกเอง</button>
        </div>
        <div class="grid grid--2">
          <BaseInput :model-value="f.loss" label="อัตราสูญเสียน้ำระหว่างทาง (%) — น้ำหนักที่หายก่อนถึงโรงงาน" inputmode="decimal" :format="dec" @update:model-value="typeLoss" />
          <BaseInput :model-value="f.drc" label="DRC ที่คาดว่าโรงงานจะวัดได้ (%)" inputmode="decimal" :format="dec" @update:model-value="typeDrc" />
        </div>
        <div class="grid opt">
          <BaseInput v-model="f.margin" label="กำไรที่ต้องการต่อ กก. (เว้นว่าง = ไม่คิด)" inputmode="decimal" placeholder="เช่น 2" :format="dec" />
          <BaseInput v-model="f.market" label="ราคาตลาดพ่อค้าคนกลาง (เว้นว่าง = ไม่เทียบ)" inputmode="decimal" placeholder="เช่น 38" :format="dec" />
        </div>
        <ul v-if="issues.length" class="issues" role="alert"><li v-for="i in issues" :key="i">⚠ {{ i }}</li></ul>
      </section>

      <!-- ② คำนวณรายลูกค้า -->
      <section v-if="hasF" class="sub" aria-live="polite">
        <div class="sub__h"><h3>คำนวณรายลูกค้า — ควรรับซื้อกี่บาท</h3><button type="button" class="lnk" @click="addCust">+ เพิ่มลูกค้า</button></div>
        <p class="hint">ใส่ <b>คาดการณ์อัตราสูญเสีย (%)</b> ของยางแต่ละเจ้า (เว้นว่าง = ใช้ค่าด้านบน) ระบบคำนวณราคาที่ควรรับซื้อให้ได้กำไร{{ n(f.margin) > 0 ? ` ${formatNumber(n(f.margin))} บาท/กก.` : ' (ยังไม่ได้ใส่ “กำไรที่ต้องการ” = คิดแค่ไม่ขาดทุน)' }}</p>
        <div class="grid grid--s roomrow">
          <BaseInput v-model="room.up" label="เพดานบน = ราคาแนะนำ + (บาท) เผื่อต่อรองขึ้น" inputmode="decimal" :format="dec" />
          <BaseInput v-model="room.down" label="เพดานล่าง = ราคาแนะนำ − (บาท) ไว้กดราคา" inputmode="decimal" :format="dec" />
        </div>
        <div class="cust" v-for="(r, i) in custRows" :key="i">
          <div class="cust__in">
            <BaseInput v-model="r.c.name" :label="`ลูกค้าเจ้าที่ ${i + 1} (ชื่อ — ไม่บังคับ)`" placeholder="เช่น สวนลุงดำ" />
            <BaseInput v-model="r.c.loss" label="คาดการณ์อัตราสูญเสีย (%)" inputmode="decimal" :placeholder="`เว้นว่าง = ${formatNumber(n(f.loss))}`" :format="dec" />
            <BaseInput v-model="r.c.drc" label="DRC (%) — เว้นว่างก็ได้" inputmode="decimal" :placeholder="`เว้นว่าง = ${formatNumber(n(f.drc))}`" :format="dec" />
            <button v-if="custRows.length > 1" type="button" class="del" :aria-label="`ลบลูกค้าเจ้าที่ ${i + 1}`" @click="delCust(i)"><AppIcon name="x" :size="14" /></button>
          </div>
          <template v-if="r.q.recommended != null">
            <div class="quote">
              <div class="qbox qbox--up" :class="`qbox--${r.q.upperStatus}`">
                <small>เพดานบน (ถ้าลูกค้าต่อ)</small>
                <b>{{ formatNumber(r.q.upper) }}</b>
                <em>{{ STATUS_TXT[r.q.upperStatus] }} · กำไร {{ money(r.q.marginAtUpper) }}/กก.</em>
              </div>
              <div class="qbox qbox--rec" :class="`qbox--${r.q.recommendedStatus}`">
                <small>ราคาที่ควรรับซื้อ</small>
                <b class="big">{{ formatNumber(r.q.recommended) }}</b>
                <em>{{ STATUS_TXT[r.q.recommendedStatus] }} · กำไร {{ money(r.q.marginAtRecommended) }}/กก.</em>
              </div>
              <div class="qbox qbox--low qbox--ok">
                <small>เพดานล่าง (เริ่มกดราคา)</small>
                <b>{{ formatNumber(r.q.lower) }}</b>
                <em>กำไร {{ money(r.q.marginAtLower) }}/กก.</em>
              </div>
            </div>
            <p v-if="r.q.upperStatus === 'loss'" class="warns"><span class="bad">เพดานบน {{ formatNumber(r.q.upper) }} ขาดทุน — ห้ามเพิ่มราคาเกิน {{ r.q.breakevenPrice == null ? '–' : formatNumber(r.q.breakevenPrice) }} บาท/กก. (ราคาสูงสุดที่ยังไม่ขาดทุน)</span></p>
            <p v-else class="cmp">ต่อรองขึ้นได้ถึงเพดานบน · ราคาสูงสุดที่ยังไม่ขาดทุน {{ r.q.breakevenPrice == null ? '–' : formatNumber(r.q.breakevenPrice) }} บาท/กก. <span class="muted">(สูญเสีย {{ formatNumber(r.loss) }}% · DRC {{ formatNumber(r.drc) }}% → y {{ pctOf(r.q.y) }})</span></p>
            <ul v-if="r.notWorth || r.below" class="warns">
              <li v-for="w in [...r.q.warnings, ...(r.below ? [r.below] : [])]" :key="w.code + w.message" :class="w.code === 'NOT_WORTH' ? 'bad' : 'warn'">{{ w.message }}</li>
            </ul>
          </template>
          <ul v-else class="warns"><li v-for="w in r.q.warnings" :key="w.code" class="bad">{{ w.message }}</li></ul>
        </div>
      </section>
      <p v-else class="hint">ใส่ราคาโรงงานด้านบน แล้วระบบจะคำนวณราคารับซื้อรายลูกค้าให้</p>

      <!-- ③ ตามเกรด -->
      <section v-if="hasF" class="sub">
        <h3 class="q q--s">ถ้าแยกตามเกรด ควรตั้งราคาประมาณเท่าไหร่?</h3>
        <div class="tbw">
          <table class="tb">
            <thead><tr><th>เกรด</th><th>ลักษณะยาง</th><th class="r">สูญเสียน้ำ</th><th class="r">DRC</th><th class="r">ตั้งราคาประมาณ</th><th>สถานะ</th></tr></thead>
            <tbody>
              <tr v-for="r in board.rows" :key="r.grade" :class="`row--${r.status}`">
                <td><b>{{ r.grade }}</b></td><td>{{ GRADE_DESC[r.grade] }}</td>
                <td class="r muted">{{ formatNumber(n(f.gradeLoss[r.grade])) }}%</td><td class="r muted">{{ formatNumber(n(f.gradeDrc[r.grade])) }}%</td>
                <td class="r"><b>{{ r.buyPrice == null ? '–' : formatNumber(r.buyPrice) }}</b></td>
                <td><span class="pill" :class="`pill--${r.status}`" :title="r.warnings.map((w) => w.message).join(' / ')">{{ STATUS[r.status] }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="board.warnings.length" class="warns"><span class="bad">{{ board.warnings[0].message }} — ระบบไม่ปรับราคาขึ้นให้ ต้องตัดสินใจเองว่าจะรับหรือไม่</span></p>
        <p class="muted small">สูญเสียน้ำและ DRC ของแต่ละเกรดเป็นค่าเริ่มต้นสมมติ (ราคาในตารางนี้ใช้สูตรเดียวกับด้านบน) — ปรับจากล็อตจริงได้ที่เครื่องมือ “ปรับค่าจากล็อตจริง”</p>
      </section>

      <!-- ④ ตั้งค่าเพิ่มเติม -->
      <section class="sub">
        <button type="button" class="fold" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen"><span class="chev" :class="{ up: moreOpen }">▸</span> ตั้งค่าเพิ่มเติม <span class="muted">(ไม่ต้องกรอกก็ได้)</span></button>
        <div v-show="moreOpen" class="more">
          <p class="sub__t">ค่าของแต่ละเกรด <span class="muted">— ค่าสมมติ ควรปรับจากล็อตจริง</span></p>
          <div class="gtab">
            <div v-for="g in GRADES" :key="g" class="gtab__row">
              <b>เกรด {{ g }}</b>
              <BaseInput :model-value="f.gradeLoss[g]" label="สูญเสียน้ำ (%)" inputmode="decimal" :format="dec" @update:model-value="(v) => setGradeCell('loss', g, v)" />
              <BaseInput :model-value="f.gradeDrc[g]" label="DRC (%)" inputmode="decimal" :format="dec" @update:model-value="(v) => setGradeCell('drc', g, v)" />
            </div>
          </div>
          <button type="button" class="lnk" @click="reset">ล้างทุกช่อง / กลับเป็นค่าเริ่มต้น</button>
        </div>
      </section>

      <!-- ⑤ เครื่องมือเพิ่มเติม -->
      <section class="sub tools">
        <p class="sub__t">เครื่องมือเพิ่มเติม</p>

        <details class="tool">
          <summary><b>ลองกับน้ำหนักจริง (ซื้อ → หายระหว่างทาง → ขายโรงงาน)</b><small>ดูว่าล็อตนี้ได้เงินเท่าไหร่ กำไรหรือขาดทุน และกราฟตามอัตราสูญเสียน้ำ / DRC</small></summary>
          <div class="grid">
            <BaseInput v-model="lot.kg" label="รับซื้อมา (กก.)" inputmode="decimal" placeholder="เช่น 1500" :format="dec" />
            <BaseInput v-model="lot.buy" label="ราคารับซื้อ (บาท/กก.)" inputmode="decimal" :placeholder="res.price != null && hasF ? `เว้นว่าง = ราคาที่ตั้ง ${formatNumber(res.price)}` : 'เช่น 36'" :format="dec" />
            <BaseInput v-model="lot.loss" label="น้ำหนักหายระหว่างทาง (%)" inputmode="decimal" :placeholder="`เว้นว่าง = ${formatNumber(n(f.loss))}`" :format="dec" />
            <BaseInput v-model="lot.drc" label="DRC ที่โรงงานวัดได้ (%)" inputmode="decimal" :placeholder="`เว้นว่าง = ${formatNumber(n(f.drc))}`" :format="dec" />
            <BaseInput v-model="lot.fixed" label="ต้นทุนคงที่ของล็อต (บาท)" inputmode="decimal" placeholder="เว้นว่าง = ตามที่ตั้งไว้" :format="dec" />
          </div>
          <p v-if="!hasF" class="hint">ใส่ราคาโรงงานด้านบนก่อน</p>
          <template v-else-if="lotOk">
            <ol class="flow">
              <li><small>รับซื้อ</small><b>{{ formatNumber(n(lot.kg)) }} กก.</b><em>จ่าย {{ formatNumber(lotRes.cost) }} บาท</em></li>
              <li><small>หายระหว่างทาง {{ formatNumber(lotLoss) }}%</small><b>− {{ formatNumber(lotRes.kgLost) }} กก.</b><em>เหลือไปถึงโรงงาน {{ formatNumber(lotRes.kgAtFactory) }} กก.</em></li>
              <li><small>DRC {{ formatNumber(lotDrc) }}%</small><b>{{ formatNumber(lotRes.dryKg) }} กก.</b><em>เนื้อยางแห้ง</em></li>
              <li><small>× ราคาโรงงาน {{ formatNumber(params.factoryPrice) }}</small><b>{{ formatNumber(lotRes.revenue) }} บาท</b><em>รายได้จากโรงงาน</em></li>
            </ol>
            <div class="tiles">
              <div class="tile tile--hi" :class="lotRes.net >= 0 ? 'pos' : 'neg'"><small>{{ lotRes.net >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ' }}</small><b>{{ money(lotRes.net) }}</b><em>{{ money(lotRes.netPerKg) }} บาท/กก. ที่ซื้อ</em></div>
              <div class="tile"><small>DRC ที่เสมอทุน</small><b>{{ lotRes.breakevenDrcPct == null ? '–' : `${formatNumber(lotRes.breakevenDrcPct)}%` }}</b><em>{{ lotRes.breakevenDrcPct != null && lotDrc < lotRes.breakevenDrcPct ? 'DRC ที่คาดต่ำกว่านี้ = ขาดทุน' : 'DRC ต่ำกว่านี้ = ขาดทุน' }}</em></div>
              <div class="tile"><small>สูญเสียน้ำสูงสุดที่ไม่ขาดทุน</small><b>{{ lotRes.breakevenLossPct == null ? '–' : lotRes.breakevenLossPct < 0 ? 'ขาดทุนแม้ไม่สูญเสีย' : `${formatNumber(lotRes.breakevenLossPct)}%` }}</b><em>มากกว่านี้ = ขาดทุน</em></div>
            </div>
            <div class="two">
              <div><p class="sub__t">กำไรสุทธิตามอัตราสูญเสียน้ำ <span class="muted">(คลิกเพื่อลองค่า)</span></p>
                <EstimateLineChart :points="curveLoss" :current="{ x: lotLoss, y: lotRes.net }" :markers="markLoss" :x-fmt="(v) => `${formatNumber(v)}%`" :y-fmt="(v) => formatNumber(Math.round(v))" x-label="สูญเสียน้ำ" y-label="กำไร" @pick="pickLoss" /></div>
              <div><p class="sub__t">กำไรสุทธิตาม DRC ที่โรงงานวัดได้ <span class="muted">(คลิกเพื่อลองค่า)</span></p>
                <EstimateLineChart :points="curveDrc" :current="{ x: lotDrc, y: lotRes.net }" :markers="markDrc" :x-fmt="(v) => `${formatNumber(v)}%`" :y-fmt="(v) => formatNumber(Math.round(v))" x-label="DRC" y-label="กำไร" @pick="pickDrc" /></div>
            </div>
          </template>
          <p v-else class="hint">กรอกน้ำหนักที่รับซื้อเพื่อดูผล</p>
        </details>

        <details class="tool">
          <summary><b>เงินสดที่ต้องเตรียม</b><small>วันนี้ควรมีเงินสดเท่าไหร่ถึงจะพอรับซื้อ</small></summary>
          <div class="grid">
            <BaseInput v-model="cash.kg" label="คาดว่าจะรับซื้อ (กก.)" inputmode="decimal" placeholder="เช่น 1500" :format="dec" />
            <BaseInput v-model="cash.extra" label="เผื่อเพิ่ม (กก.)" inputmode="decimal" placeholder="เว้นว่าง = ไม่เผื่อ" :format="dec" />
            <BaseInput v-model="cash.buy" label="ราคารับซื้อ (บาท/กก.)" inputmode="decimal" :placeholder="res.price != null && hasF ? `เว้นว่าง = ราคาที่ตั้ง ${formatNumber(res.price)}` : 'เช่น 37'" :format="dec" />
          </div>
          <div v-if="n(cash.kg) > 0 && cashRes.cash > 0" class="tiles">
            <div class="tile tile--hi pos"><small>เงินสดที่ควรเตรียม</small><b>{{ formatNumber(cashRes.cash) }}</b><em>บาท · {{ formatNumber(cashRes.plannedKg) }} กก.</em></div>
          </div>
          <p v-if="cashRes.capped" class="warns"><span class="warn">เกินปริมาณรับซื้อสูงสุด {{ formatNumber(DEFAULT_PARAMS.maxDailyKg) }} กก./วัน — ใช้ {{ formatNumber(cashRes.plannedKg) }} กก. ในการคำนวณ</span></p>
        </details>

        <details class="tool">
          <summary><b>ปรับค่าจากล็อตจริง</b><small>ใส่ผลชั่งจริงจากโรงงาน ระบบหาอัตราสูญเสียน้ำและ DRC เฉลี่ยให้ แล้วนำไปใช้แทนค่าสมมติได้</small></summary>
          <div class="lots">
            <div v-for="(l, i) in lots" :key="i" class="lotrow">
              <select v-model="l.grade" aria-label="เกรด"><option value="">ไม่ระบุเกรด</option><option v-for="g in GRADES" :key="g" :value="g">เกรด {{ g }}</option></select>
              <BaseInput v-model="l.kgPurchased" label="ซื้อมา (กก.)" inputmode="decimal" placeholder="1813.3" :format="dec" />
              <BaseInput v-model="l.kgFactory" label="โรงงานชั่งได้ (กก.)" inputmode="decimal" placeholder="1699.8" :format="dec" />
              <BaseInput v-model="l.drc" label="DRC (%)" inputmode="decimal" placeholder="58.7" :format="dec" />
              <button type="button" class="del" :aria-label="`ลบล็อต ${i + 1}`" @click="delLot(i)"><AppIcon name="x" :size="14" /></button>
            </div>
            <button type="button" class="lnk" @click="addLot">+ เพิ่มล็อต</button>
          </div>
          <div v-if="calib.lotCount" class="tiles">
            <div class="tile"><small>น้ำหนักหายระหว่างทาง (เฉลี่ย)</small><b>{{ formatNumber(calib.weightedLossPct) }}%</b><em>{{ calib.lotCount }} ล็อต · {{ formatNumber(calib.totalKgPurchased) }} กก.</em></div>
            <div class="tile"><small>DRC เฉลี่ย</small><b>{{ formatNumber(calib.weightedDrcPct) }}%</b></div>
            <div class="tile"><small>y เฉลี่ย = (1 − สูญเสีย) × DRC</small><b>{{ pctOf(calib.weightedYield) }}</b></div>
          </div>
          <p v-else-if="!calibEmpty" class="hint">ข้อมูลล็อตยังไม่ครบ (ต้องมี ซื้อมา, โรงงานชั่งได้ และ DRC)</p>
          <p v-if="calib.skippedLots && calib.lotCount" class="warns"><span class="warn">ข้าม {{ calib.skippedLots }} ล็อตที่ข้อมูลไม่ครบ</span></p>
          <div v-if="calib.lotCount" class="acts">
            <button type="button" class="btn" @click="applyCalib">ใช้เป็นค่าสูญเสียน้ำและ DRC ของยางที่คิดอยู่</button>
            <button v-if="Object.keys(calib.byGrade).length" type="button" class="btn" @click="applyGradeCalib">ใส่ค่าให้เกรดที่มีข้อมูล ({{ Object.keys(calib.byGrade).join(', ') }})</button>
          </div>
        </details>
      </section>
    </div>
  </section>
</template>

<style scoped>
.card { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg, 14px); }
.panel { padding: 0; }
.panel__head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 14px 16px; text-align: left; font-size: 15px; color: var(--slate-900); }
.panel__head b { font-weight: 800; }
.chev { display: inline-block; transition: transform .15s; color: var(--slate-500); } .chev.up { transform: rotate(90deg); }
.panel__sum { margin-left: auto; padding: 3px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: var(--slate-100); color: var(--slate-600); }
.panel__sum.ok { background: var(--green-50); color: var(--green-700); } .panel__sum.bad { background: var(--red-50); color: var(--red-700); }
.panel__body { padding: 0 16px 8px; }
.note { margin: 0 0 6px; font-size: 12px; line-height: 1.7; color: var(--slate-600); }
.sub { padding: 14px 0; border-top: 1px solid var(--slate-100); }
.sub__h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; } .sub__h h3 { flex: 1; font-size: 14px; font-weight: 800; color: var(--slate-900); }
.sub__t { margin: 12px 0 6px; font-size: 12px; font-weight: 600; color: var(--slate-600); } .muted { font-weight: 500; color: var(--slate-400); }
.lnk { font-size: 12px; font-weight: 600; color: var(--blue-700); text-align: left; } .lnk:hover { text-decoration: underline; } .adv { margin-top: 10px; }
.adv__body { margin-top: 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px 14px; align-items: start; } .grid--s { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
.withbtn { display: flex; flex-direction: column; gap: 4px; }
.chk { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-600); }
.issues { margin: 10px 0 0; padding: 8px 12px 8px 28px; border-radius: var(--radius-md); background: var(--red-50); color: var(--red-700); font-size: 12px; font-weight: 600; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 10px 0; }
.tile { padding: 10px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 2px; }
.tile small { font-size: 11px; color: var(--slate-500); } .tile b { font-size: 18px; font-weight: 800; color: var(--slate-900); } .tile em { font-style: normal; font-size: 11px; color: var(--slate-500); }
.tile--hi { background: var(--blue-50); border-color: var(--blue-100); } .tile--hi b { color: var(--blue-700); }
.tile--hi.pos { background: var(--green-50); border-color: var(--green-100); } .tile--hi.pos b { color: var(--green-700); }
.tile--hi.neg { background: var(--red-50); border-color: #fecaca; } .tile--hi.neg b { color: var(--red-700); }
.warns { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; }
.warns li, .warns span { padding: 7px 12px; border-radius: var(--radius-md); display: block; }
.bad { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; } .warn { background: var(--amber-50); color: var(--amber-700); border: 1px solid #fcd34d; }
.cmp { margin-top: 8px; font-size: 12.5px; color: var(--slate-600); }
.tbw { overflow-x: auto; } .tb { width: 100%; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.tb th { text-align: left; font-size: 11px; color: var(--slate-500); padding: 5px 10px; white-space: nowrap; } .tb td { padding: 7px 10px; border-top: 1px solid var(--slate-100); } .tb .r { text-align: right !important; }
.row--not_worth td { background: #fff7f7; } .row--cur td { background: var(--blue-50); } .row--neg td:nth-child(3) b { color: var(--red-700); }
.pill { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; border: 1px solid; }
.pill--ok { background: var(--green-50); color: var(--green-700); border-color: var(--green-100); } .pill--capped { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; } .pill--not_worth { background: var(--red-50); color: var(--red-700); border-color: #fecaca; }
.seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; margin-bottom: 10px; }
.seg button { padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); } .seg button.on { background: var(--blue-50); color: var(--blue-700); font-weight: 700; }
.how { margin-top: 10px; } .how summary { cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--slate-700, #334155); }
.lots { display: flex; flex-direction: column; gap: 8px; }
.lotrow { display: grid; grid-template-columns: 130px repeat(3, minmax(110px, 1fr)) 32px; gap: 10px; align-items: end; }
.lotrow select { height: 44px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font: inherit; font-size: 13px; }
.del { height: 44px; color: var(--slate-400); } .del:hover { color: var(--red-700); }
.acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.btn { padding: 8px 14px; border-radius: var(--radius-md); background: var(--blue-50); color: var(--blue-700); border: 1px solid var(--blue-100); font-size: 12px; font-weight: 700; } .btn:hover:not(:disabled) { background: var(--blue-100); } .btn:disabled { opacity: .5; }
@media (max-width: 640px) { .lotrow { grid-template-columns: 1fr 1fr; } }
.q { margin: 0 0 10px; font-size: 16px; font-weight: 800; color: var(--slate-900); } .q--s { font-size: 14px; }
.ask { max-width: 360px; } .ask :deep(input) { font-size: 20px; font-weight: 800; }
.opt { margin-top: 12px; }
.yrow { display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 10px 16px; align-items: end; } .yrow p { margin: 0 0 10px; }
.answer { padding: 14px 16px; border-radius: var(--radius-lg, 14px); border: 1px solid; display: flex; flex-direction: column; gap: 3px; }
.answer.pos { background: var(--green-50); border-color: var(--green-100); color: var(--green-700); } .answer.neg { background: var(--red-50); border-color: #fecaca; color: var(--red-700); }
.answer p { margin: 0; font-size: 14px; } .answer__b { font-size: 15px !important; } .answer .big { font-size: 28px; font-weight: 800; margin: 0 4px; } .answer__c { font-size: 12px !important; opacity: .8; }
.eq { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; font-size: 13px; }
.eq li { display: grid; grid-template-columns: 1fr 90px 1.1fr; gap: 10px; align-items: baseline; padding: 6px 4px; border-top: 1px solid var(--slate-100); } .eq b { text-align: right; font-variant-numeric: tabular-nums; } .eq small { color: var(--slate-500); }
.eq__sum { background: var(--slate-50, #f8fafc); font-weight: 700; }
.rev { margin-top: 14px; padding: 12px; border: 1px dashed var(--slate-300); border-radius: var(--radius-md); max-width: 560px; } .rev__a { margin: 8px 0 0; font-size: 13px; line-height: 1.7; color: var(--slate-700, #334155); }
.hint { margin: 8px 0; font-size: 12.5px; color: var(--slate-500); } .small { font-size: 11.5px; margin-top: 6px; }
.fold { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 800; color: var(--slate-900); } .more { margin-top: 12px; }
.tools .tool { border: 1px solid var(--slate-100); border-radius: var(--radius-md); padding: 0 14px; margin-bottom: 8px; background: #fff; }
.tool > summary { cursor: pointer; padding: 11px 0; display: flex; flex-direction: column; gap: 1px; list-style: none; } .tool > summary::-webkit-details-marker { display: none; }
.tool > summary b { font-size: 13.5px; color: var(--slate-900); } .tool > summary small { font-size: 11.5px; color: var(--slate-500); }
.tool[open] > summary { border-bottom: 1px solid var(--slate-100); margin-bottom: 12px; } .tool[open] { padding-bottom: 12px; }
.grid--2 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 10px; }
.chain { margin: 8px 0 0; padding: 8px 12px; border-radius: var(--radius-md); background: var(--blue-50); color: var(--blue-700); font-size: 12.5px; line-height: 1.7; } .chain b { font-weight: 800; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 14px; margin-top: 6px; }
.gtab { display: flex; flex-direction: column; gap: 8px; } .gtab__row { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 10px; align-items: end; } .gtab__row b { padding-bottom: 12px; font-size: 13px; }
.flow { list-style: none; margin: 10px 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; counter-reset: s; }
.flow li { position: relative; padding: 10px 12px 10px 34px; border: 1px solid var(--slate-100); border-radius: var(--radius-md); background: #fff; display: flex; flex-direction: column; gap: 1px; counter-increment: s; }
.flow li::before { content: counter(s); position: absolute; left: 10px; top: 10px; width: 18px; height: 18px; border-radius: 9999px; background: var(--blue-50); color: var(--blue-700); font-size: 11px; font-weight: 800; display: grid; place-items: center; }
.flow small { font-size: 11px; color: var(--slate-500); } .flow b { font-size: 16px; font-weight: 800; color: var(--slate-900); } .flow em { font-style: normal; font-size: 11px; color: var(--slate-500); }
.ask { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); } .ask :deep(input) { font-size: 16px; } .ask > :first-child :deep(input) { font-size: 20px; font-weight: 800; }
.roomrow { margin-bottom: 10px; }
.cust { padding: 12px; margin-bottom: 10px; border: 1px solid var(--slate-100); border-radius: var(--radius-md); background: #fff; }
.cust__in { display: grid; grid-template-columns: minmax(150px, 1.3fr) minmax(130px, 1fr) minmax(130px, 1fr) 32px; gap: 10px; align-items: end; }
.quote { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-top: 10px; }
.qbox { padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid; display: flex; flex-direction: column; gap: 2px; }
.qbox small { font-size: 11px; font-weight: 700; } .qbox b { font-size: 24px; font-weight: 800; } .qbox b.big { font-size: 32px; } .qbox em { font-style: normal; font-size: 11.5px; }
.qbox--ok { background: var(--green-50); border-color: var(--green-100); color: var(--green-700); }
.qbox--low { background: var(--amber-50); border-color: #fcd34d; color: var(--amber-700); }
.qbox--loss { background: var(--red-50); border-color: #f87171; color: var(--red-700); box-shadow: inset 0 0 0 1px #f87171; }
.qbox--rec { box-shadow: 0 0 0 2px rgba(37, 99, 235, .18); }
.qbox--up, .qbox--rec { order: 0; }
@media (max-width: 640px) { .cust__in { grid-template-columns: 1fr 1fr; } }
</style>

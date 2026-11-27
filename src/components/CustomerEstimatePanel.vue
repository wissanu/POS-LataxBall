<script setup>
// ประเมินราคารายลูกค้า — เปิดจากหน้า "ข้อมูลลูกค้า" (/estimate?customer=<key>)
//   y = DRC ตอนซื้อเฉลี่ยของลูกค้าคนนั้น (จากบิลขายโรงงานจริง) → ราคาที่ควรรับซื้อวันนี้ที่ยังได้กำไร M บาท/กก. (สูตรเดิม A_max = P × y − F ÷ W − M)
//   ถ้าลูกค้าให้เทิร์นน้ำ T นาที (กำหนดเอง): คำนวณน้ำหนักที่หายจากเส้นโค้งที่ปรับจากเที่ยวจริง → ราคา/กก. หลังเทิร์นสูงสุดที่ให้ได้
//   ราคาโรงงาน P, กำไร M, ค่าใช้จ่ายคงที่ F, ปริมาณ/วัน W — กรอกเองทั้งหมด (จำค่าล่าสุดไว้ในเครื่อง)
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseInput from '@/components/BaseInput.vue'
import CustomerProfile from '@/components/CustomerProfile.vue'
import ProfitVolumeChart from '@/components/ProfitVolumeChart.vue'
import { customerStatsService } from '@/services/customerStatsService'
import { getErrorMessage } from '@/services/http'
import { quote, wetFactor, profitSeries } from '@/utils/customerEstimate'
import { useFactoryPriceStore } from '@/stores/factoryPrice'
import { formatMoney, formatNumber, sanitizeDecimal, toNumber } from '@/utils/format'

const props = defineProps({ customerKey: { type: String, required: true }, startOpen: { type: Boolean, default: false } })
const open = ref(props.startOpen) // ย่อเป็นค่าเริ่มต้น เว้นแต่เพิ่งเลือกลูกค้ามา
const router = useRouter()
const fp = useFactoryPriceStore()
const data = ref(null)
const loading = ref(false)
const error = ref('')

const LS = 'pos.custEstimate.v1'
const saved = (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} } })()
const f = reactive({ P: '', level: '', M: saved.M ?? '1', F: saved.F ?? '', W: saved.W ?? '', step: saved.step ?? '0.5', minutes: saved.minutes ?? '30', basis: 'avg', manual: '', turnOn: true })
watch(() => [f.M, f.F, f.W, f.step, f.minutes], () => { try { localStorage.setItem(LS, JSON.stringify({ M: f.M, F: f.F, W: f.W, step: f.step, minutes: f.minutes })) } catch { /* ไม่เป็นไร */ } })
const dec = (v) => sanitizeDecimal(v, 2)
// ราคาโรงงาน P: ใช้ราคาโรงงานวันนี้จากการ์ดด้านบน (ประเมินจากราคากลาง/ที่คุณแก้) — พิมพ์ทับในแผงนี้ได้เฉพาะการคำนวณนี้
const pTouched = ref(false)
watch(() => fp.data?.price, (v) => { if (!pTouched.value && v != null) f.P = String(v) }, { immediate: true })
const LEVELS = [{ v: 1, t: 'แห้งมาก' }, { v: 2, t: 'แห้ง' }, { v: 3, t: 'ปกติ' }, { v: 4, t: 'อมน้ำ' }, { v: 5, t: 'อมน้ำมาก' }]

async function load() {
  loading.value = true; error.value = ''
  try { data.value = await customerStatsService.detail(props.customerKey) } catch (e) { data.value = null; error.value = getErrorMessage(e, 'โหลดข้อมูลลูกค้าไม่สำเร็จ') } finally { loading.value = false }
}
onMounted(load)
watch(() => props.customerKey, load)

const c = computed(() => data.value?.customer ?? null)
const CONF = { none: 'ยังไม่มีบิลขายโรงงาน', low: 'ข้อมูลน้อย — ค่าอยู่ใกล้ค่าเฉลี่ยร้าน', mid: 'พอใช้', high: 'น่าเชื่อถือ' }
const delta = computed(() => (f.level ? data.value?.levels?.find((l) => l.level === Number(f.level))?.deltaPct ?? 0 : null))
const yPct = computed(() => {
  if (f.basis === 'manual') return toNumber(f.manual)
  if (!c.value || c.value.drcPct == null) return (data.value?.globalDrcPct ?? 0) + (delta.value ?? 0)
  if (f.basis === 'simple') return c.value.simplePct
  // ระบุระดับยางวันนี้ = ฐานของลูกค้า (ถ้ายางปกติ) + ผลของระดับนั้นที่เรียนรู้จากบิลจริง · ไม่ระบุ = ตามที่ลูกค้าคนนี้มักมา
  const center = delta.value != null ? c.value.baseDrcPct + delta.value : c.value.drcPct
  return f.basis === 'safe' ? center - c.value.sePct : center
})
const noData = computed(() => !c.value || c.value.drcPct == null)
const wet = computed(() => wetFactor(c.value?.drcPct ?? data.value?.globalDrcPct ?? 0, data.value?.globalDrcPct ?? 0))
const q = computed(() => quote({ P: toNumber(f.P), y: yPct.value / 100, M: toNumber(f.M), F: toNumber(f.F), W: toNumber(f.W), step: toNumber(f.step), curve: data.value?.lossCurve, wet: wet.value }))
const T = computed(() => Math.max(0, toNumber(f.minutes)))
const turn = computed(() => q.value.at(T.value))
const table = computed(() => [0, 10, 20, 30, 40, 60, 90, 120].map((m) => q.value.at(m)))
const money = (v) => (v == null || !Number.isFinite(v) ? '–' : `${v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`)
const num = (v) => (v == null || !Number.isFinite(v) ? '–' : formatNumber(v))
// กราฟ: กำไร/กก. ตามน้ำหนักรับซื้อต่อวัน ที่ราคารับซื้อที่แสดง · เทิร์น T และ T±10 นาที
const SERIES_STYLE = [{ color: '#64748b' }, { color: '#93c5fd', dash: '5 4' }, { color: '#16a34a' }, { color: '#2563eb', dash: '5 4' }]
const chart = computed(() => {
  if (!q.value.ok || !(toNumber(f.F) > 0)) return null
  const s = profitSeries(q.value, toNumber(f.F), toNumber(f.W), T.value)
  const lab = (m) => (m === 0 ? `ไม่เทิร์น (ราคา ${num(q.value.price)})` : `เทิร์น ${m} นาที${m === T.value ? ' (ที่เลือก)' : ''} (ราคา ${num(q.value.at(m).priceTurn)})`)
  let k = 0
  return { xMax: s.xMax, series: s.mins.map((m) => { const st = m.minutes === 0 ? SERIES_STYLE[0] : m.minutes === T.value ? SERIES_STYLE[2] : m.minutes < T.value ? SERIES_STYLE[1] : SERIES_STYLE[3]; k++; return { label: lab(m.minutes), color: st.color, dash: st.dash, breakEven: m.breakEven, points: m.points } }) }
})
const curveNote = computed(() => (data.value?.lossCurve.source === 'prior' ? 'ค่าตั้งต้นจากล็อตจริง 1,813 → 1,699.8 กก. ยังไม่มีเที่ยวจริงให้ปรับ' : 'ปรับจาก ' + data.value?.lossCurve.points + ' เที่ยวจริงที่ซื้อและได้บิลโรงงานในวันเดียวกัน'))
const verdict = computed(() => {
  if (!q.value.ok) return { cls: 'idle', text: 'กรอกราคาโรงงาน (P) เพื่อให้คำนวณราคาที่ควรรับซื้อ' }
  if (q.value.aMax <= 0) return { cls: 'bad', text: 'ไม่คุ้ม — ที่ราคาโรงงานและ DRC นี้ ราคารับซื้อสูงสุดที่ยังได้กำไรเป้าไม่เกิน 0 บาท/กก.' }
  return { cls: 'ok', text: `ลูกค้าคนนี้ควรรับซื้อไม่เกิน ${num(q.value.price)} บาท/กก. (สูงสุดก่อนปัด ${num(q.value.aMax)})` }
})
</script>

<template>
  <section class="card cep" aria-label="ประเมินราคารายลูกค้า">
    <button type="button" class="ph" :aria-expanded="open" @click="open = !open">
      <span class="chev" :class="{ up: open }">▸</span><b>ประเมินราคารายลูกค้า{{ c ? ` — ${c.name}` : '' }}</b>
      <span v-if="!open && c && q.ok" class="sum">ควรรับซื้อไม่เกิน {{ num(q.price) }} บาท/กก.</span>
    </button>
    <p v-if="loading && open" class="muted">กำลังโหลด…</p>
    <p v-else-if="error && open" class="err" role="alert">{{ error }}</p>
    <template v-else-if="c">
     <div v-show="open" class="cbody">
      <header class="hd">
        <div>
          <h2>{{ c.name }} <small>{{ c.type === 'member' ? 'ลูกค้าประจำ' : c.type === 'garden' ? 'สวน' : 'ลูกค้าทั่วไป' }}</small></h2>
          <p class="muted">
            <template v-if="!noData">DRC ตอนซื้อเฉลี่ย <b>{{ num(c.drcPct) }}%</b> (ถ้ายางปกติ {{ num(c.baseDrcPct) }}% · เฉลี่ยตรง ๆ {{ num(c.simplePct) }}% · ค่าระวัง {{ num(c.safePct) }}%) · {{ c.lots }} ล็อต · {{ CONF[c.confidence] }}</template>
            <template v-else>ยังไม่มีบิลขายโรงงานของลูกค้าคนนี้ — ใช้ค่าเฉลี่ยทั้งร้าน {{ num(data.globalDrcPct) }}% แทน หรือกรอกเอง</template>
          </p>
        </div>
        <button type="button" class="lnk" @click="router.push({ name: 'customers' })">← เลือกลูกค้าอื่น</button>
      </header>
      <CustomerProfile :customer="c" />

      <div class="basis" role="group" aria-label="DRC ที่ใช้คำนวณ">
        <span>DRC ที่ใช้:</span>
        <label v-for="b in [{ v: 'avg', t: 'ค่าประมาณ' }, { v: 'safe', t: 'ค่าระวัง (−1 SE)' }, { v: 'simple', t: 'เฉลี่ยตรง ๆ' }, { v: 'manual', t: 'กรอกเอง' }]" :key="b.v" :class="{ on: f.basis === b.v }">
          <input v-model="f.basis" type="radio" :value="b.v" :disabled="noData && b.v !== 'manual' && b.v !== 'avg'" /> {{ b.t }}
        </label>
        <input v-if="f.basis === 'manual'" :value="f.manual" inputmode="decimal" class="mini" placeholder="DRC %" @input="f.manual = dec($event.target.value)" />
        <b class="yv">= {{ num(yPct) }}%</b>
      </div>

      <div class="lvl" role="radiogroup" aria-label="ระดับยางวันนี้">
        <span>ยางของเขาวันนี้:</span>
        <button type="button" :class="{ on: f.level === '' }" @click="f.level = ''">ตามปกติของลูกค้า</button>
        <button v-for="l in LEVELS" :key="l.v" type="button" :class="{ on: Number(f.level) === l.v }" @click="f.level = l.v">{{ l.t }}<small v-if="data.levels"> {{ data.levels[l.v - 1].deltaPct > 0 ? '+' : '' }}{{ num(data.levels[l.v - 1].deltaPct) }}</small></button>
      </div>
      <p v-if="!noData && c.ratedPct < 50" class="muted">จดระดับความแห้งไว้แค่ {{ num(c.ratedPct) }}% ของยางลูกค้าคนนี้ — จดที่หน้ารับออเดอร์ใหม่ ทุกใบ ค่า DRC จะแม่นขึ้น</p>

      <div class="grid">
        <BaseInput v-model="f.P" label="ราคาโรงงาน P (บาท/กก. ยางแห้ง 100%)" inputmode="decimal" placeholder="เช่น 72" :format="dec" @update:model-value="pTouched = true" />
        <BaseInput v-model="f.M" label="กำไรที่ต้องการ M (บาท/กก.)" inputmode="decimal" placeholder="เช่น 1" :format="dec" />
        <BaseInput v-model="f.F" label="ค่าใช้จ่ายคงที่ F (บาท/วัน)" inputmode="decimal" placeholder="เช่น 1834" :format="dec" />
        <BaseInput v-model="f.W" label="ปริมาณรับซื้อต่อวัน W (กก.)" inputmode="decimal" placeholder="เช่น 1500" :format="dec" />
        <label class="sel"><span>ปัดราคาลงทีละ</span><select v-model="f.step"><option value="0.5">0.50 บาท</option><option value="1">1 บาท</option><option value="0">ไม่ปัด</option></select></label>
      </div>

      <div class="verdict" :class="verdict.cls">{{ verdict.text }}</div>
      <div v-if="q.ok" class="tiles">
        <div class="tile tile--hi"><small>ราคาที่ควรรับซื้อวันนี้</small><b>{{ num(q.price) }}</b><em>บาท/กก. (กำไร {{ num(q.margin) }}/กก.)</em></div>
        <div class="tile"><small>มูลค่ายางต่อ กก. (P × DRC)</small><b>{{ num(q.value) }}</b><em>บาท/กก.</em></div>
        <div class="tile"><small>ต้นทุนคงที่ต่อ กก. (F ÷ W)</small><b>{{ num(q.fixedKg) }}</b><em>บาท/กก.</em></div>
        <div class="tile"><small>ราคาสูงสุดก่อนปัด A_max</small><b>{{ num(q.aMax) }}</b><em>= P×DRC − F÷W − M</em></div>
      </div>

      <section class="turn">
        <h3>ถ้าลูกค้าให้เทิร์นน้ำก่อนชั่ง</h3>
        <div class="grid grid--s">
          <BaseInput v-model="f.minutes" label="เทิร์น (นาที)" inputmode="decimal" placeholder="เช่น 30" :format="dec" />
        </div>
        <template v-if="q.ok">
          <div class="tiles">
            <div class="tile"><small>น้ำหนักหายที่ {{ num(T) }} นาที</small><b>{{ num(turn.lossPct) }}%</b><em>เหลือ {{ num(turn.keptKg) }} กก. ต่อ 100 กก.</em></div>
            <div class="tile tile--hi"><small>ราคา/กก. หลังเทิร์นสูงสุดที่ให้ได้</small><b>{{ num(turn.priceTurn) }}</b><em>บาท/กก. (ก่อนปัด {{ num(turn.maxTurn) }})</em></div>
            <div class="tile"><small>เงินที่จ่ายต่อยางลูกค้า 100 กก.</small><b>{{ num(turn.payPer100) }}</b><em>ไม่เทิร์น: {{ num(q.price == null ? null : q.price * 100) }} บาท</em></div>
          </div>
          <table class="tb">
            <thead><tr><th>เทิร์น (นาที)</th><th class="r">น้ำหนักหาย</th><th class="r">ราคา/กก. สูงสุด</th><th class="r">กำไร/กก. (ก่อนเทิร์น)</th></tr></thead>
            <tbody><tr v-for="r in table" :key="r.minutes" :class="{ cur: r.minutes === T }"><td>{{ r.minutes === 0 ? 'ไม่เทิร์น' : r.minutes }}</td><td class="r">{{ num(r.lossPct) }}%</td><td class="r"><b>{{ num(r.priceTurn) }}</b></td><td class="r">{{ num(r.marginPerKg) }}</td></tr></tbody>
          </table>
          <p class="cap">
            น้ำหนักหาย = {{ num(data.lossCurve.lmaxPct) }}% × (1 − e<sup>−นาที/{{ data.lossCurve.tauMin }}</sup>) × ตัวคูณความเปียกของยางลูกค้า {{ num(wet) }}
            ({{ curveNote }}) —
            เนื้อยางแห้งเท่าเดิม ยอดเงินรวมที่จ่ายได้จึงเท่าเดิม ราคา/กก. ที่สูงขึ้นคือการหารด้วยน้ำหนักที่เหลือ เป็นค่าประมาณ ควรเทียบกับของจริงเมื่อมีเที่ยวมากขึ้น
          </p>
        </template>
      </section>

      <section v-if="q.ok" class="chartbox">
        <h3>ต้องรับซื้อกี่ กก./วัน ถึงจะไม่ขาดทุน <small>ที่ราคารับซื้อที่แสดงด้านบน</small></h3>
        <ProfitVolumeChart v-if="chart" :series="chart.series" :x-max="chart.xMax" :W="toNumber(f.W)" />
        <p v-else class="muted">ใส่ค่าใช้จ่ายคงที่ F (บาท/วัน) เพื่อดูกราฟ — ถ้าไม่มีต้นทุนคงที่ กำไร/กก. จะเท่ากันทุกน้ำหนัก</p>
        <p v-if="chart" class="cap">เส้นเหนือศูนย์ = ไม่ขาดทุน จุดที่เส้นตัดศูนย์ = น้ำหนักรับซื้อต่อวันขั้นต่ำ · กำไร/กก. นับต่อน้ำหนักก่อนเทิร์น · ราคาปัดลงทีละ {{ f.step }} บาท จึงบางนาทีเส้นอยู่สูง/ต่ำกว่านาทีข้างเคียงเป็นขั้น ๆ ได้</p>
      </section>

      <details v-if="data.history.length" class="hist">
        <summary>ประวัติ DRC ตอนซื้อรายล็อตของลูกค้าคนนี้ ({{ data.history.length }})</summary>
        <table class="tb">
          <thead><tr><th>วันที่ขาย</th><th>บิลขาย</th><th class="r">ยางของลูกค้า</th><th class="r">สัดส่วนในล็อต</th><th class="r">DRC ตอนซื้อของล็อต</th></tr></thead>
          <tbody><tr v-for="h in [...data.history].reverse()" :key="h.saleNo + h.date"><td>{{ h.date }}</td><td>{{ h.saleNo }}</td><td class="r">{{ num(h.kg) }} กก.</td><td class="r">{{ num(h.sharePct) }}%</td><td class="r"><b>{{ num(h.lotDrcPct) }}%</b></td></tr></tbody>
        </table>
        <p class="cap">โรงงานวัด DRC ต่อล็อตรวม — ล็อตที่มีคนอื่นปนอยู่ ค่าของล็อตไม่ใช่ของคนนี้ล้วน ๆ ระบบจึงแยกให้ตามสัดส่วนและหลายล็อตประกอบกัน</p>
      </details>
     </div>
    </template>
  </section>
</template>

<style scoped>
.card { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg, 14px); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.ph { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; font-size: 15px; color: var(--slate-900); } .ph b { font-weight: 800; }
.chev { display: inline-block; transition: transform .15s; color: var(--slate-500); } .chev.up { transform: rotate(90deg); }
.sum { margin-left: auto; padding: 3px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: var(--green-50); color: var(--green-700); }
.cbody { display: flex; flex-direction: column; gap: 12px; }
.chartbox { border-top: 1px solid var(--slate-100); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; } .chartbox h3 small { font-size: 11px; font-weight: 600; color: var(--slate-500); margin-left: 6px; }
.hd { display: flex; gap: 12px; align-items: flex-start; } .hd > div { flex: 1; min-width: 0; }
h2 { font-size: 18px; font-weight: 800; color: var(--slate-900); } h2 small { font-size: 12px; font-weight: 600; color: var(--slate-500); margin-left: 6px; }
h3 { font-size: 14px; font-weight: 800; color: var(--slate-900); margin: 0 0 8px; }
.muted { font-size: 12.5px; color: var(--slate-600); line-height: 1.6; } .err { font-size: 13px; color: var(--red-700); }
.lnk { font-size: 12px; font-weight: 600; color: var(--blue-700); white-space: nowrap; } .lnk:hover { text-decoration: underline; }
.lvl { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-500); }
.lvl button { padding: 5px 10px; border: 1px solid var(--slate-200); border-radius: 9999px; background: #fff; font-size: 12px; color: var(--slate-700); }
.lvl button.on { background: var(--blue-50); border-color: var(--blue-100); color: var(--blue-700); font-weight: 700; } .lvl small { color: var(--slate-400, #94a3b8); }
.basis { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; font-size: 12px; color: var(--slate-500); }
.basis label { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: 1px solid var(--slate-200); border-radius: 9999px; cursor: pointer; color: var(--slate-700); }
.basis label.on { background: var(--blue-50); border-color: var(--blue-100); color: var(--blue-700); font-weight: 700; }
.mini { width: 90px; height: 32px; padding: 0 8px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); font: inherit; } .yv { color: var(--slate-900); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px 14px; align-items: start; } .grid--s { max-width: 260px; }
.sel { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--slate-800); }
.sel select { height: 44px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font: inherit; }
.verdict { padding: 10px 14px; border-radius: var(--radius-md); font-size: 13.5px; font-weight: 700; }
.verdict.ok { background: var(--green-50); color: var(--green-700); } .verdict.bad { background: var(--red-50); color: var(--red-700); } .verdict.idle { background: #f8fafc; color: var(--slate-600); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.tile { padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 2px; }
.tile small, .tile em { font-style: normal; font-size: 11px; color: var(--slate-500); } .tile b { font-size: 20px; font-weight: 800; color: var(--slate-900); }
.tile--hi { background: var(--green-50); border-color: var(--green-100); } .tile--hi b { color: var(--green-700); }
.turn { border-top: 1px solid var(--slate-100); padding-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.tb { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 6px; } .tb th { text-align: left; font-size: 11px; color: var(--slate-500); padding: 4px 8px; } .tb td { padding: 7px 8px; border-top: 1px solid var(--slate-100); }
.tb .r { text-align: right; white-space: nowrap; } .tb tr.cur td { background: var(--blue-50); }
.cap { font-size: 12px; color: var(--slate-600); line-height: 1.7; }
.hist summary { cursor: pointer; font-size: 13px; font-weight: 800; color: var(--slate-900); }
</style>

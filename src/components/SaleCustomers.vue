<script setup>
// บิลขายโรงงาน 1 ใบ → แยกรายลูกค้า (ณ วันที่ซื้อยางของแต่ละคน) ไว้คัดลูกค้าดี/ลูกค้าแย่ ตัดสินใจรับซื้อครั้งต่อไป
//   ราคาโรงงานวันนั้น · ราคาที่รับซื้อ · DRC% (คาดการณ์ ณ ตอนซื้อ) · DRC (จริง) · กำไร/กก. (คาดการณ์/จริง) · กำไรขั้นต้น (คืนทุนไหม) · กำไร (จริง) · รูปภาพ
//   ดึงตอนกางบิลเท่านั้น (ไม่ดึงล่วงหน้า) · แต่ละคนมี dropdown กางดูรายละเอียด
import { computed, onMounted, ref } from 'vue'
import PhotoStrip from './PhotoStrip.vue'
import { billsService } from '@/services/billsService'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'
import { formatKg, formatMoney, formatNumber } from '@/utils/format'

const props = defineProps({ saleId: { type: String, required: true } })
const data = ref(null)
const loading = ref(true)
const error = ref('')
const open = ref(new Set())

async function load() {
  loading.value = true; error.value = ''
  try { data.value = await billsService.saleCustomers(props.saleId) } catch (e) { error.value = getErrorMessage(e, 'โหลดข้อมูลรายลูกค้าไม่สำเร็จ') } finally { loading.value = false }
}
onMounted(load)

const rows = computed(() => data.value?.rows ?? [])
const key = (r, i) => `${r.date}|${r.key ?? 'anon'}|${i}`
const toggle = (k) => { const s = new Set(open.value); s.has(k) ? s.delete(k) : s.add(k); open.value = s }
const allOpen = computed(() => rows.value.length > 0 && rows.value.every((r, i) => open.value.has(key(r, i))))
const toggleAll = () => { open.value = allOpen.value ? new Set() : new Set(rows.value.map(key)) }
const num = (v, suffix = '') => (v == null ? '–' : `${formatNumber(v)}${suffix}`)
const signed = (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${formatMoney(v)}`)
const BASIS = { measured: 'โรงงานวัดตรง (ยางล็อตนี้เป็นของคนเดียว)', model: 'โมเดลแยกให้จากบิลทุกใบ (ล็อตที่ปนหลายคน)', lot: 'ค่าเฉลี่ยของล็อต (ไม่ระบุชื่อ)' }
const TYPE = { member: 'ลูกค้าประจำ', general: 'ทั่วไป', garden: 'สวน' }
const tone = (r) => (r.grossProfit == null ? 'wait' : r.grossProfit < 0 ? 'bad' : r.drcGapPct != null && r.drcGapPct < -2 ? 'warn' : 'ok')
</script>

<template>
  <section class="sc">
    <header class="sc__head">
      <h4>ลูกค้าในบิลนี้ <small v-if="rows.length">{{ rows.length }} รายการ (ลูกค้า × วันที่ซื้อ)</small></h4>
      <button v-if="rows.length > 1" type="button" class="sc__all" @click="toggleAll">{{ allOpen ? 'ย่อทั้งหมด' : 'กางทั้งหมด' }}</button>
    </header>
    <p v-if="loading" class="sc__muted">กำลังโหลด…</p>
    <p v-else-if="error" class="sc__err">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>
    <p v-else-if="!rows.length" class="sc__muted">ไม่มีข้อมูลยางต้นทางของบิลนี้</p>
    <template v-else>
      <p v-if="data.waitingBill" class="sc__note">ยังรอยอดบิล/DRC% จากโรงงาน — ค่า “จริง” และกำไรจะขึ้นเมื่อกรอกบิลโรงงานแล้ว</p>
      <ul class="sc__list">
        <li v-for="(r, i) in rows" :key="key(r, i)" class="sc__item" :class="`sc__item--${tone(r)}`">
          <button type="button" class="sc__row" :aria-expanded="open.has(key(r, i))" @click="toggle(key(r, i))">
            <span class="chev" :class="{ up: open.has(key(r, i)) }">▸</span>
            <b class="nm">{{ r.name }}</b>
            <span class="tp">{{ TYPE[r.type] }}</span>
            <span class="dt">ซื้อ {{ formatThaiDate(r.date) }}</span>
            <span class="kv">{{ formatKg(r.kg) }}</span>
            <span class="kv">DRC {{ num(r.estDrcPct, '%') }} → <b>{{ num(r.actualDrcPct, '%') }}</b></span>
            <span class="kv" :class="{ neg: r.actualProfitPerKg != null && r.actualProfitPerKg < 0 }">กำไร/กก. <b>{{ signed(r.actualProfitPerKg) }}</b></span>
            <span v-if="r.recovered != null" class="rec" :class="r.recovered ? 'rec--ok' : 'rec--bad'">{{ r.recovered ? 'คืนทุน' : 'ไม่คืนทุน' }}</span>
          </button>
          <div v-if="open.has(key(r, i))" class="sc__body">
            <dl class="g">
              <div><dt>ราคาโรงงานวันนั้น</dt><dd>{{ num(r.factoryPriceDay) }}<small>บาท/กก. ยางแห้ง</small></dd></div>
              <div><dt>ราคาที่รับซื้อ</dt><dd>{{ num(r.buyPrice) }}<small>บาท/กก. · ต้นทุน {{ formatMoney(r.cost) }}</small></dd></div>
              <div><dt>DRC% (คาดการณ์)</dt><dd>{{ num(r.estDrcPct, '%') }}<small>ที่คาดตอนซื้อ</small></dd></div>
              <div :title="BASIS[r.actualBasis] ?? ''"><dt>DRC (จริง)</dt><dd>{{ num(r.actualDrcPct, '%') }}<small>{{ r.actualBasis ? BASIS[r.actualBasis].split(' (')[0] : 'รอบิลโรงงาน' }}<template v-if="r.drcGapPct != null"> · <i :class="{ neg: r.drcGapPct < 0 }">{{ r.drcGapPct > 0 ? '+' : '' }}{{ formatNumber(r.drcGapPct) }} จากที่คาด</i></template></small></dd></div>
              <div><dt>กำไร/กก. (คาดการณ์)</dt><dd :class="{ neg: r.estProfitPerKg != null && r.estProfitPerKg < 0 }">{{ signed(r.estProfitPerKg) }}</dd></div>
              <div><dt>กำไร/กก. (จริง)</dt><dd :class="{ neg: r.actualProfitPerKg != null && r.actualProfitPerKg < 0 }">{{ signed(r.actualProfitPerKg) }}</dd></div>
              <div><dt>กำไรขั้นต้น (คืนทุนไหม)</dt><dd :class="{ neg: r.grossProfit != null && r.grossProfit < 0 }">{{ signed(r.grossProfit) }}<small>{{ r.recovered == null ? 'รอบิล' : r.recovered ? 'คืนทุนแล้ว' : 'ไม่คืนทุน' }} · รายได้ที่ตกกับคนนี้ {{ r.revenue == null ? '–' : formatMoney(r.revenue) }}</small></dd></div>
              <div><dt>กำไร (จริง)</dt><dd :class="{ neg: r.netProfit != null && r.netProfit < 0 }">{{ signed(r.netProfit) }}<small>หักค่าใช้จ่ายรายวันส่วนของคนนี้ {{ formatMoney(r.expenseShare) }}</small></dd></div>
              <div class="g__photo"><dt>รูปภาพ</dt><dd><PhotoStrip :ids="r.photos" /></dd></div>
            </dl>
            <p class="sc__muted">ใบรับซื้อ {{ r.purchaseNos.join(', ') }}</p>
          </div>
        </li>
      </ul>
      <p class="sc__foot">DRC (จริง) = ยางล็อตที่เป็นของคนเดียวใช้ค่าที่โรงงานวัดตรง ๆ · ล็อตที่ปนหลายคนใช้ค่าที่โมเดลแยกให้ (ถ่วงน้ำหนัก/ความใหม่/ลักษณะยาง ไม่ใช่การถัวเฉลี่ย) · รายได้ของบิลแบ่งตามเนื้อยางแห้งของแต่ละคน</p>
    </template>
  </section>
</template>

<style scoped>
.sc { display: flex; flex-direction: column; gap: 6px; }
.sc__head { display: flex; align-items: center; gap: 10px; } .sc__head h4 { font-size: 13px; font-weight: 800; color: var(--slate-900); flex: 1; } .sc__head small { font-weight: 500; color: var(--slate-500); margin-left: 6px; }
.sc__all { font-size: 11px; font-weight: 700; color: var(--blue-700); }
.sc__muted { font-size: 11px; color: var(--slate-400); } .sc__err { font-size: 12px; color: #dc2626; } .sc__err button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.sc__note { font-size: 11px; color: var(--amber-700); background: var(--amber-50); padding: 4px 10px; border-radius: 8px; }
.sc__foot { font-size: 10.5px; color: var(--slate-400); line-height: 1.5; }
.sc__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.sc__item { border: 1px solid var(--slate-100); border-left: 4px solid var(--slate-300); border-radius: 10px; background: #fff; overflow: hidden; }
.sc__item--ok { border-left-color: #16a34a; } .sc__item--warn { border-left-color: #d97706; } .sc__item--bad { border-left-color: #dc2626; }
.sc__row { width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 8px 12px; text-align: left; font-size: 12px; color: var(--slate-600); }
.chev { display: inline-block; font-size: 10px; transition: transform .15s; } .chev.up { transform: rotate(90deg); }
.nm { color: var(--slate-900); font-size: 13px; } .tp { padding: 0 8px; border-radius: 9999px; background: var(--slate-100); font-size: 10.5px; font-weight: 600; }
.kv { font-variant-numeric: tabular-nums; } .kv b { color: var(--slate-900); } .kv.neg b, .neg { color: #dc2626 !important; }
.rec { margin-left: auto; padding: 1px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1px solid; } .rec--ok { background: #f0fdf4; color: #15803d; border-color: #86efac; } .rec--bad { background: #fef2f2; color: #dc2626; border-color: #fca5a5; }
.sc__body { padding: 4px 12px 10px; border-top: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 6px; }
.g { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.g > div { padding: 6px 10px; border-radius: 8px; background: var(--slate-50); display: flex; flex-direction: column; gap: 2px; }
.g dt { font-size: 10.5px; font-weight: 700; color: var(--slate-500); } .g dd { margin: 0; font-size: 15px; font-weight: 800; color: var(--slate-900); font-variant-numeric: tabular-nums; display: flex; flex-direction: column; }
.g dd small { font-size: 10.5px; font-weight: 500; color: var(--slate-500); } .g dd small i { font-style: normal; }
.g__photo { grid-column: 1 / -1; } .g__photo dd { flex-direction: row; }
</style>

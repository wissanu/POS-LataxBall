<script setup>
// ราคาโรงงานวันนี้ (ประเมินจากราคากลางยางก้อนถ้วย DRC 100% ของ กยท.) — ระบบดึงให้วันละครั้ง ตรวจแล้วแก้เองได้
//   ประเมิน = ราคากลางล่าสุดที่รู้ตอนเช้า + ส่วนต่างเฉลี่ยที่โรงงานของร้านให้เทียบราคากลาง (เรียนรู้จากบิลขายโรงงานจริง)
//   ตารางด้านล่างเทียบแต่ละบิลกับราคากลาง บอกว่าแหล่งข้อมูลสอดคล้องกับที่ร้านรับซื้อ/ขายจริงแค่ไหน
import { computed, onMounted, ref, watch } from 'vue'
import BaseInput from '@/components/BaseInput.vue'
import { useFactoryPriceStore } from '@/stores/factoryPrice'
import { formatThaiDate } from '@/utils/dates'
import { formatNumber, sanitizeDecimal, toNumber } from '@/utils/format'

const fp = useFactoryPriceStore()
const draft = ref('')
const open = ref(false) // ย่อเป็นค่าเริ่มต้น
const showCheck = ref(false)
const refDate = ref('')
const refPrice = ref('')
const SRC = { checkraka: 'CheckRaka (ราคาปิดตลาดกลาง กยท.)', misdata: 'กยท. (misdata.rubberthaiecon.com)', manual: 'กรอกเอง', history: 'ราคากลางที่เก็บไว้' }
const VERDICT = {
  insufficient: { t: 'ยังสรุปไม่ได้ (มีบิลที่เทียบได้น้อยกว่า 2 บิล)', c: 'idle' },
  good: { t: 'สอดคล้องดี — ส่วนต่างระหว่างราคาโรงงานกับราคากลางนิ่ง ใช้ประเมินได้', c: 'ok' },
  fair: { t: 'พอใช้ — ส่วนต่างแกว่งพอสมควร ควรตรวจราคาก่อนใช้ทุกวัน', c: 'warn' },
  poor: { t: 'ไม่สอดคล้อง — ราคาโรงงานไม่ตามราคากลาง ควรกรอกราคาโรงงานเอง', c: 'bad' },
}

onMounted(async () => { await fp.load(); fp.loadCheck() })
const d = computed(() => fp.data)
watch(d, (v) => { if (v) draft.value = v.price == null ? '' : String(v.price) }, { immediate: true })
const dec = (v) => sanitizeDecimal(v, 2)
const edited = computed(() => d.value?.manualPrice != null)
const dirty = computed(() => draft.value !== '' && toNumber(draft.value) !== (d.value?.price ?? null))
const save = () => fp.setManual(toNumber(draft.value))
const clear = async () => { await fp.setManual(null) }
const age = (lag) => (lag == null ? '' : lag <= 0 ? 'วันนี้' : lag === 1 ? 'เมื่อวาน' : `${lag} วันก่อน`)
const refText = computed(() => (d.value?.ref ? `${formatThaiDate(d.value.ref.date)} (${age(d.value.ref.lagDays)})` : ''))
const n = (v) => (v == null ? '–' : formatNumber(v))
const signed = (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${formatNumber(v)}`)
const addRef = async () => { if (refDate.value && toNumber(refPrice.value) > 0) { await fp.addRef(refDate.value, toNumber(refPrice.value)); refPrice.value = '' } }
const toggleCheck = () => { showCheck.value = !showCheck.value }
</script>

<template>
  <section class="card fpc" aria-label="ราคาโรงงานวันนี้">
    <button type="button" class="ph" :aria-expanded="open" @click="open = !open">
      <span class="chev" :class="{ up: open }">▸</span><b>ราคาโรงงานวันนี้</b>
      <span v-if="!open" class="sum">{{ d?.price != null ? `${n(d.price)} บาท/กก.${d.manualPrice != null ? ' (แก้เอง)' : ' (ประเมิน)'}` : 'ยังไม่มีราคา' }}<template v-if="d?.ref"> · ราคากลางวันที่ {{ refText }}</template><template v-else-if="d?.basisBill"> · จากบิล {{ formatThaiDate(d.basisBill.date) }}</template></span>
    </button>
    <div v-show="open" class="body">
    <header class="hd">
      <div>
        <h2>ราคาโรงงานวันนี้ <small>คำนวณจากบิลโรงงาน + ราคากลาง กยท. · ตรวจแล้วแก้เองได้</small></h2>
        <p v-if="d?.ref" class="muted">
          ราคากลางยางก้อนถ้วย DRC 100% <b>{{ n(d.ref.price) }}</b> บาท/กก. — <b>ดึงจากราคาปิดตลาดวันที่ {{ refText }}</b> · {{ SRC[d.ref.source] ?? d.ref.source }}
        </p>
        <p v-else-if="fp.loading" class="muted">กำลังดึงราคากลาง…</p>
        <p v-else class="muted">ยังดึงราคากลางไม่ได้ (ดูสาเหตุที่ “ผลการดึงข้อมูลล่าสุด”) — <template v-if="d?.estPrice != null">ประเมินจากบิลขายโรงงานล่าสุดแทน</template><template v-else>กรอกราคาโรงงานเองได้ที่ช่องด้านล่าง</template></p>
        <!-- ราคาโรงงานประเมินมาจากอะไร — โรงงานไม่แจ้งราคา คำนวณย้อนกลับจากบิล: ยอดเงิน ÷ (น้ำหนักสุทธิ × DRC%) -->
        <p v-if="d?.basis && d.basis !== 'none'" class="muted basis">
          <template v-if="d.basis === 'bill_today'">ราคาโรงงานจากบิลขายวันนี้ ({{ d.basisBill?.saleNo }}): ยอดเงิน ÷ (น้ำหนักสุทธิ × DRC%) = <b>{{ n(d.basisBill?.price) }}</b> บาท/กก.</template>
          <template v-else-if="d.basis === 'ref_offset'">ราคากลางล่าสุด {{ n(d.ref?.price) }} {{ signed(d.offset.baht) }} (ส่วนต่างที่โรงงานให้เทียบราคากลาง คำนวณจาก {{ d.offset.n }} บิล: ยอดเงิน ÷ (น้ำหนักสุทธิ × DRC%))</template>
          <template v-else-if="d.basis === 'bill_latest'">คำนวณจากบิลขายโรงงานล่าสุด {{ formatThaiDate(d.basisBill?.date) }} ({{ d.basisBill?.saleNo }}): ยอดเงิน ÷ (น้ำหนักสุทธิ × DRC%) = <b>{{ n(d.basisBill?.price) }}</b> บาท/กก. — ยังไม่ได้ปรับตามราคากลาง เพราะไม่มีราคากลางของวันที่ออกบิล (เติมย้อนหลังได้ด้านล่าง)</template>
          <template v-else>ยังไม่มีบิลขายโรงงาน จึงใช้ราคากลางตรง ๆ</template>
        </p>
      </div>
      <button type="button" class="lnk" :disabled="fp.loading" @click="fp.refresh()">ดึงราคากลางใหม่</button>
    </header>

    <p v-if="d?.status === 'stale'" class="warn">ยังไม่มีราคาของวันที่ {{ formatThaiDate(d.expectedRefDate) }} — ใช้ราคาย้อนหลังล่าสุดที่มี คือวันที่ {{ refText }} อาจเป็นวันหยุดตลาดหรือแหล่งยังไม่อัปเดต ตรวจราคาก่อนใช้</p>
    <p v-if="d?.note" class="warn">{{ d.note }}</p>
    <details v-if="d?.sourceAttempts?.length || d?.lastError" class="diag">
      <summary>ผลการดึงข้อมูลล่าสุด<template v-if="d.lastAttemptAt"> ({{ new Date(d.lastAttemptAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }})</template></summary>
      <ul>
        <li v-for="(a, i) in d.sourceAttempts" :key="i"><b>{{ a.source }}</b> — <template v-if="a.ok">ได้ราคา {{ n(a.price) }} ของวันที่ {{ formatThaiDate(a.date) }}</template><template v-else>ไม่สำเร็จ: {{ a.error }}</template></li>
        <li v-if="!d.sourceAttempts?.length && d.lastError">{{ d.lastError }}</li>
      </ul>
    </details>
    <p v-if="fp.error" class="err" role="alert">{{ fp.error }}</p>

    <div class="row">
      <BaseInput v-model="draft" label="ราคาโรงงาน (บาท/กก. ยางแห้ง 100%)" inputmode="decimal" placeholder="เช่น 72" :format="dec" />
      <div class="act">
        <button type="button" class="btn" :disabled="!dirty" @click="save">ใช้ราคานี้</button>
        <button v-if="edited" type="button" class="lnk" @click="clear">กลับไปใช้ค่าประเมิน ({{ n(d.estPrice) }})</button>
      </div>
      <p class="muted src">{{ edited ? 'ราคาที่คุณแก้เอง' : d?.estPrice != null ? 'ค่าประเมินจากราคากลาง (ยังไม่ได้ตรวจ)' : '' }}</p>
    </div>

    <button type="button" class="lnk" @click="toggleCheck">{{ showCheck ? 'ซ่อน' : 'ดู' }}ผลเทียบราคากลางกับบิลขายโรงงาน</button>
    <div v-if="showCheck && fp.check" class="chk">
      <div class="verdict" :class="VERDICT[fp.check.verdict].c">{{ VERDICT[fp.check.verdict].t }}</div>
      <p v-if="fp.check.n" class="muted">
        ส่วนต่างราคาโรงงานเทียบราคากลางเฉลี่ย {{ signed(fp.check.meanOffset) }} บาท/กก. (แกว่ง ±{{ n(fp.check.sdOffset) }}) ·
        ร้านจ่ายซื้อเฉลี่ย {{ n(fp.check.paidPctOfRefMean) }}% ของราคากลาง<template v-if="fp.check.paidPctOfRefSd != null"> (แกว่ง ±{{ n(fp.check.paidPctOfRefSd) }})</template>
        <template v-if="fp.check.moves"> · ราคาขยับทิศเดียวกับราคากลาง {{ fp.check.moveAgree }}/{{ fp.check.moves }} ครั้ง</template>
      </p>
      <div class="scroll-x">
        <table class="tb">
          <thead><tr><th>วันที่</th><th>บิลขาย</th><th class="r">ราคาโรงงานตามบิล</th><th class="r">ราคากลาง (วันที่)</th><th class="r">ส่วนต่าง</th><th class="r">ร้านจ่ายเฉลี่ย</th><th class="r">% ของราคากลาง</th></tr></thead>
          <tbody>
            <tr v-for="r in fp.check.rows" :key="r.tripId">
              <td>{{ r.date }}</td><td>{{ r.saleNo }}</td><td class="r">{{ n(r.billP) }}</td>
              <td class="r">{{ r.refPrice == null ? 'ยังไม่มี' : `${n(r.refPrice)} (${r.refDate})` }}</td>
              <td class="r">{{ signed(r.offset) }}</td><td class="r">{{ n(r.paidAvg) }}</td><td class="r">{{ r.paidPctOfRef == null ? '–' : n(r.paidPctOfRef) + '%' }}</td>
            </tr>
            <tr v-if="!fp.check.rows.length"><td colspan="7" class="muted">ยังไม่มีบิลขายโรงงานที่กรอกราคา + DRC%</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="fp.check.missingRefDates.length" class="fill">
        <p class="muted">บิลวันที่ {{ fp.check.missingRefDates.join(', ') }} ยังไม่มีราคากลางก่อนหน้า (ระบบเก็บให้ตั้งแต่วันที่เริ่มดึง) — เติมราคากลางย้อนหลังเองได้:</p>
        <div class="fillrow">
          <input v-model="refDate" type="date" class="mini" aria-label="วันที่ของราคากลาง" />
          <input :value="refPrice" inputmode="decimal" class="mini" placeholder="ราคากลาง บาท/กก." @input="refPrice = dec($event.target.value)" />
          <button type="button" class="btn" @click="addRef">เพิ่ม</button>
        </div>
      </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.card { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg, 14px); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.ph { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; font-size: 15px; color: var(--slate-900); } .ph b { font-weight: 800; }
.chev { display: inline-block; transition: transform .15s; color: var(--slate-500); } .chev.up { transform: rotate(90deg); }
.sum { margin-left: auto; padding: 3px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: var(--slate-100); color: var(--slate-600); }
.body { display: flex; flex-direction: column; gap: 10px; }
.hd { display: flex; gap: 12px; align-items: flex-start; } .hd > div { flex: 1; min-width: 0; }
h2 { font-size: 16px; font-weight: 800; color: var(--slate-900); } h2 small { font-size: 11px; font-weight: 600; color: var(--slate-500); margin-left: 6px; }
.muted { font-size: 12.5px; color: var(--slate-600); line-height: 1.6; } .diag { font-size: 12px; color: var(--slate-600); } .diag summary { cursor: pointer; font-weight: 600; } .diag ul { margin: 6px 0 0; padding-left: 18px; line-height: 1.7; }
.warn { font-size: 12.5px; color: #b45309; background: #fffbeb; padding: 6px 10px; border-radius: var(--radius-md); } .err { font-size: 13px; color: var(--red-700); }
.lnk { font-size: 12px; font-weight: 600; color: var(--blue-700); align-self: flex-start; white-space: nowrap; } .lnk:hover { text-decoration: underline; } .lnk:disabled { opacity: .5; }
.row { display: grid; grid-template-columns: minmax(220px, 300px) auto 1fr; gap: 10px 14px; align-items: end; }
.act { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; } .src { padding-bottom: 12px; }
.btn { height: 44px; padding: 0 16px; border-radius: var(--radius-md); background: var(--blue-600, #2563eb); color: #fff; font-weight: 700; font-size: 13px; } .btn:disabled { opacity: .4; }
.chk { display: flex; flex-direction: column; gap: 8px; }
.verdict { padding: 8px 12px; border-radius: var(--radius-md); font-size: 13px; font-weight: 700; }
.verdict.ok { background: var(--green-50); color: var(--green-700); } .verdict.warn { background: #fffbeb; color: #b45309; } .verdict.bad { background: var(--red-50); color: var(--red-700); } .verdict.idle { background: #f8fafc; color: var(--slate-600); }
.scroll-x { overflow-x: auto; } .tb { width: 100%; border-collapse: collapse; font-size: 12.5px; } .tb th { text-align: left; font-size: 11px; color: var(--slate-500); padding: 4px 8px; white-space: nowrap; } .tb td { padding: 6px 8px; border-top: 1px solid var(--slate-100); white-space: nowrap; } .tb .r { text-align: right; }
.fillrow { display: flex; gap: 8px; flex-wrap: wrap; } .mini { height: 36px; padding: 0 8px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); font: inherit; }
@media (max-width: 720px) { .row { grid-template-columns: 1fr; } }
</style>

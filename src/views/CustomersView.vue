<script setup>
// ข้อมูลลูกค้า — รายชื่อลูกค้าที่เคยขายยางให้ร้าน พร้อม "DRC ตอนซื้อเฉลี่ย" รายคน (จากบิลขายโรงงานจริง)
//   ค้นหาชื่อได้จากช่องค้นหาด้านบนสุด · คลิกลูกค้า → ไปหน้า "ประเมินราคา" ของลูกค้าคนนั้น
//   ค่าเฉลี่ยคำนวณสดทุกครั้งที่เปิดหน้า: บิลใหม่ที่กรอกแล้วจึงปรับ DRC ขึ้น/ลงให้เอง (วิธีคิดดูใน "วิธีคำนวณ DRC เฉลี่ย")
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import CustomerProfile from '@/components/CustomerProfile.vue'
import { customerStatsService } from '@/services/customerStatsService'
import { getErrorMessage } from '@/services/http'
import { useSearchStore } from '@/stores/search'
import { formatKg, formatNumber, firstLetter } from '@/utils/format'

const router = useRouter()
const find = useSearchStore()
const data = ref(null)
const loading = ref(false)
const error = ref('')
const sort = ref('drcAsc')
const SORTS = [
  { v: 'drcAsc', label: 'DRC ต่ำ → สูง' }, { v: 'drcDesc', label: 'DRC สูง → ต่ำ' },
  { v: 'kg', label: 'ซื้อมากสุด' }, { v: 'recent', label: 'ล่าสุด' }, { v: 'name', label: 'ชื่อ ก-ฮ' },
]
const TYPE = { member: 'ลูกค้าประจำ', general: 'ลูกค้าทั่วไป', garden: 'สวน' }
const CONF = { none: 'ยังไม่มีบิลขายโรงงาน', low: 'ข้อมูลน้อย', mid: 'พอใช้', high: 'น่าเชื่อถือ' }

const updatedAt = ref(null)
async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try { data.value = await customerStatsService.list(); updatedAt.value = new Date() } catch (e) { error.value = getErrorMessage(e, 'โหลดข้อมูลลูกค้าไม่สำเร็จ') } finally { loading.value = false }
}
// คำนวณสดทุกครั้งที่เปิดหน้า + เมื่อกลับมาที่แท็บนี้ (เช่น เพิ่งบันทึกการขนส่งในอีกหน้าต่าง) — ข้อมูลใหม่จึงเข้าโมเดลเสมอ
const onVisible = () => { if (document.visibilityState === 'visible') load(true) }
onMounted(() => { find.customerQuery = ''; load(); document.addEventListener('visibilitychange', onVisible) })
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
const clock = (d) => (d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '')

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '')
const rows = computed(() => {
  const q = norm(find.customerQuery)
  const list = (data.value?.customers ?? []).filter((c) => !q || norm(c.name).includes(q))
  const num = (v, d) => (v == null ? d : v)
  const by = {
    drcAsc: (a, b) => num(a.drcPct, 999) - num(b.drcPct, 999), drcDesc: (a, b) => num(b.drcPct, -1) - num(a.drcPct, -1),
    kg: (a, b) => b.boughtKg - a.boughtKg, recent: (a, b) => (a.lastBuyDate < b.lastBuyDate ? 1 : -1), name: (a, b) => a.name.localeCompare(b.name, 'th'),
  }
  return [...list].sort(by[sort.value])
})
const g = computed(() => data.value?.globalDrcPct ?? null)
const tone = (c) => (c.drcPct == null || g.value == null ? 'idle' : c.drcPct < g.value - 1 ? 'bad' : c.drcPct > g.value + 1 ? 'ok' : 'mid')
const open = (c) => router.push({ name: 'estimate', query: { customer: c.key } })
const trendTxt = (t) => (t == null ? '' : `${t > 0 ? '▲' : t < 0 ? '▼' : '='} ${formatNumber(Math.abs(t))} จุด`)
</script>

<template>
  <section class="cv glass">
    <header class="head">
      <div>
        <h1>ข้อมูลลูกค้า</h1>
        <p>DRC ตอนซื้อเฉลี่ยรายลูกค้า จากบิลขายโรงงานจริง — พิมพ์ชื่อที่ช่องค้นหาด้านบน แล้วคลิกลูกค้าเพื่อประเมินราคาที่ควรรับซื้อ</p>
      </div>
      <button type="button" class="lnk" :disabled="loading" @click="load(true)">รีเฟรช<template v-if="updatedAt"> · อัปเดต {{ clock(updatedAt) }}</template></button>
      <label class="sort"><span>เรียง</span>
        <select v-model="sort"><option v-for="s in SORTS" :key="s.v" :value="s.v">{{ s.label }}</option></select>
      </label>
    </header>

    <div class="scroll">
      <p v-if="loading" class="muted">กำลังโหลด…</p>
      <p v-else-if="error" class="err" role="alert">{{ error }} <button type="button" class="lnk" @click="load">ลองใหม่</button></p>
      <template v-else-if="data">
        <div class="tiles">
          <div class="tile"><small>DRC ตอนซื้อเฉลี่ยทั้งร้าน</small><b>{{ g == null ? '–' : formatNumber(g) + '%' }}</b><em>จาก {{ data.lotCount }} บิลขายโรงงาน</em></div>
          <div class="tile"><small>ลูกค้าที่มีชื่อ</small><b>{{ data.customers.length }}</b><em>มี DRC แล้ว {{ data.customers.filter((c) => c.drcPct != null).length }} คน</em></div>
          <div class="tile"><small>เส้นโค้งน้ำหนักหายตามเวลา</small><b>สูงสุด {{ formatNumber(data.lossCurve.lmaxPct) }}%</b><em>{{ data.lossCurve.source === 'prior' ? 'ค่าตั้งต้น (ยังไม่มีเที่ยวจริงพอ)' : `ปรับจาก ${data.lossCurve.points} เที่ยวจริง` }}</em></div>
        </div>

        <p v-if="!rows.length" class="muted">{{ find.customerQuery ? `ไม่พบลูกค้าที่ชื่อตรงกับ “${find.customerQuery}”` : 'ยังไม่มีลูกค้าที่กรอกชื่อ — ใส่ชื่อลูกค้าที่หน้ารับออเดอร์ใหม่ แล้วผูกยางกับบิลขายโรงงานที่หน้า การขนส่ง' }}</p>
        <ul v-else class="list">
          <li v-for="c in rows" :key="c.key">
            <button type="button" class="row" :class="`row--${tone(c)}`" @click="open(c)">
              <span class="av">{{ firstLetter(c.name) }}</span>
              <span class="who">
                <b>{{ c.name }}</b>
                <small>{{ TYPE[c.type] }} · ขายให้ร้าน {{ c.orders }} ใบ · {{ formatKg(c.boughtKg) }} · ล่าสุด {{ c.lastBuyDate }}</small>
                <CustomerProfile :customer="c" compact />
              </span>
              <span class="drc">
                <template v-if="c.drcPct != null">
                  <b>{{ formatNumber(c.drcPct) }}%</b>
                  <small>{{ CONF[c.confidence] }} · {{ c.lots }} ล็อต<template v-if="c.trendPct != null"> · <i :class="c.trendPct < 0 ? 'dn' : 'up'">{{ trendTxt(c.trendPct) }}</i></template></small>
                </template>
                <template v-else><b class="na">–</b><small>{{ CONF.none }}</small></template>
              </span>
              <AppIcon name="cash" :size="16" />
            </button>
          </li>
        </ul>

        <details class="card how">
          <summary>วิธีคำนวณ DRC เฉลี่ย</summary>
          <ol>
            <li><b>DRC ตอนซื้อของล็อต</b> = (น้ำหนักสุทธิโรงงาน × DRC% โรงงาน) ÷ น้ำหนักที่ซื้อมา — รวมน้ำหนักที่หายระหว่างทางไว้แล้ว ใช้ตรงกับสูตรราคา</li>
            <li>โรงงานวัดเป็นค่ารวมทั้งล็อต ระบบจึงแยกกลับเป็นรายลูกค้าด้วยการถ่วงตามสัดส่วนน้ำหนักของแต่ละคนในล็อตนั้น และเมื่อมีหลายล็อตที่ลูกค้าปนกันคนละสัดส่วน ค่าของแต่ละคนจะถูกแยกออกจากกันแม่นขึ้นเรื่อย ๆ</li>
            <li><b>ระดับความแห้งที่จดตอนรับซื้อ</b> (แห้งมาก–อมน้ำมาก) ถูกนำมาปรับ: ยางแต่ละใบ = DRC ฐานของลูกค้า + ผลของระดับนั้น ระบบเรียนรู้ผลของแต่ละระดับจากบิลจริง (ตารางด้านล่าง) ใบที่ไม่ได้จดนับเป็น “ปกติ”</li>
            <li><b>ล็อตใหม่มีน้ำหนักมากกว่า</b> (ครึ่งชีวิต {{ data.options.halfLifeDays }} วัน) เพราะคุณภาพยางเปลี่ยนตามฤดู/ฝน</li>
            <li><b>ข้อมูลน้อยจะถูกดึงเข้าหาค่าเฉลี่ยร้านเอง</b> (เหมือนมียางเฉลี่ย {{ data.options.priorKg }} กก. เป็นหลักฐานตั้งต้น) กันเดาเกินจริงจากล็อตเดียว — ยิ่งมีล็อตมาก ค่ายิ่งเป็นของลูกค้าคนนั้นจริง</li>
            <li>“ระดับความเชื่อถือ” ดูจากน้ำหนักหลักฐานที่เป็นของคนนั้นจริง ๆ · ลูกค้าทั่วไป/สวนที่ไม่กรอกชื่อจะไม่ถูกนับรายคน (แต่ยังนับเป็นส่วนของล็อต)</li>
            <li><b>ความพรุนและจำนวนมีด</b> ก็เข้าโมเดลแบบเดียวกัน (เรียนรู้ผลต่อ DRC จากบิลจริง) และสรุปเป็น “ลักษณะยางที่ลูกค้ามักส่ง” + แนวโน้มพัฒนาขึ้น/แย่ลง จากใบรับซื้อล่าสุดเทียบก่อนหน้า (ต้องจดอย่างน้อย 4 ใบ)</li>
            <li>บิลที่ไม่ได้กรอก DRC% หรือไม่ได้ผูกใบรับซื้อต้นทาง จะไม่ถูกนำมาคิด</li>
          </ol>
          <p v-if="data.porosity" class="lvh">ผลต่อ DRC ที่ระบบเรียนรู้ (เทียบระดับ “ปกติ/ปานกลาง” = 0):</p>
          <table v-if="data.porosity" class="lv">
            <thead><tr><th>ความพรุน</th><th>ผลต่อ DRC (จุด %)</th><th>ค่าตั้งต้น</th><th>ยางที่จดระดับนี้</th></tr></thead>
            <tbody><tr v-for="l in data.porosity" :key="l.level"><td>{{ l.label }}</td><td>{{ l.deltaPct > 0 ? '+' : '' }}{{ formatNumber(l.deltaPct) }}</td><td>{{ l.priorPct > 0 ? '+' : '' }}{{ formatNumber(l.priorPct) }}</td><td>{{ formatKg(l.kg) }}</td></tr></tbody>
          </table>
          <p v-if="data.knife" class="lvh">จำนวนมีด: ทุก 1 มีดที่เพิ่ม DRC เปลี่ยน {{ data.knife.slopePct > 0 ? '+' : '' }}{{ formatNumber(data.knife.slopePct) }} จุด % (มีดเฉลี่ยร้าน {{ data.knife.meanKnives == null ? '–' : formatNumber(data.knife.meanKnives) }} · ยางที่จดมีด {{ formatKg(data.knife.kg) }}) — ค่าตั้งต้น 0 จะขยับเมื่อมีบิลที่จดมีดมากพอ</p>
          <table v-if="data.levels" class="lv">
            <thead><tr><th>ระดับ</th><th>ผลต่อ DRC (จุด %)</th><th>ค่าตั้งต้น</th><th>ยางที่จดระดับนี้</th></tr></thead>
            <tbody><tr v-for="l in data.levels" :key="l.level"><td>{{ l.label }}</td><td>{{ l.deltaPct > 0 ? '+' : '' }}{{ formatNumber(l.deltaPct) }}</td><td>{{ l.priorPct > 0 ? '+' : '' }}{{ formatNumber(l.priorPct) }}</td><td>{{ formatKg(l.kg) }}</td></tr></tbody>
          </table>
        </details>
      </template>
    </div>
  </section>
</template>

<style scoped>
.cv { flex: 1; min-width: 0; min-height: 0; padding: 20px; display: flex; flex-direction: column; overflow: hidden; }
.head { flex: none; padding-top: 16px; display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.head > div { flex: 1; min-width: 240px; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }
.sort { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-500); }
.sort select { height: 36px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font: inherit; font-size: 13px; }
.scroll { flex: 1; min-height: 0; overflow: auto; padding: 14px 2px 20px; display: flex; flex-direction: column; gap: 14px; }
.muted { font-size: 13px; color: var(--slate-500); } .err { font-size: 13px; color: var(--red-700); }
.lnk { font-size: 12px; font-weight: 600; color: var(--blue-700); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.tile { padding: 10px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 2px; }
.tile small, .tile em { font-style: normal; font-size: 11px; color: var(--slate-500); } .tile b { font-size: 20px; font-weight: 800; color: var(--slate-900); }
.list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 10px; }
.row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; background: #fff; border: 1px solid var(--slate-100); border-left-width: 4px; border-radius: var(--radius-lg, 14px); cursor: pointer; color: var(--slate-500); }
.row:hover { box-shadow: 0 2px 10px rgba(15, 23, 42, .08); }
.row--bad { border-left-color: #dc2626; } .row--ok { border-left-color: #16a34a; } .row--mid { border-left-color: #d97706; } .row--idle { border-left-color: var(--slate-200); }
.av { flex: none; width: 38px; height: 38px; border-radius: 9999px; background: var(--blue-50); color: var(--blue-700); display: grid; place-items: center; font-weight: 800; }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.who b { font-size: 14px; color: var(--slate-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .who small, .drc small { font-size: 11px; color: var(--slate-500); }
.drc { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.drc b { font-size: 20px; font-weight: 800; color: var(--slate-900); } .drc b.na { color: var(--slate-400, #94a3b8); }
.drc i { font-style: normal; font-weight: 700; } .drc i.up { color: var(--green-700); } .drc i.dn { color: var(--red-700); }
.card { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg, 14px); padding: 14px 16px; }
.how summary { cursor: pointer; font-size: 14px; font-weight: 800; color: var(--slate-900); }
.lvh { margin: 12px 0 0; font-size: 12px; color: var(--slate-600); }
.lv { margin-top: 10px; border-collapse: collapse; font-size: 12.5px; } .lv th { text-align: left; font-size: 11px; color: var(--slate-500); padding: 4px 14px 4px 0; } .lv td { padding: 5px 14px 5px 0; border-top: 1px solid var(--slate-100); }
.how ol { margin: 10px 0 0; padding-left: 20px; font-size: 12.5px; line-height: 1.8; color: var(--slate-600); }
</style>

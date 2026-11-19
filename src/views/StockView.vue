<script setup>
// ยางรอขาย: ยางที่รับซื้อแล้วแต่ยังไม่ได้ขายให้โรงงาน — จัดกลุ่มตามวันที่ซื้อ แล้วแยกตาม "สถานะการขาย"
//   รอจัดส่ง     : ยังไม่ได้เลือกไปในฉบับร่างเที่ยวขนส่งใด (เปลี่ยนสถานะ ขายต่อวัน ⇄ ค้างคืน ได้ตลอด)
//   กำลังจัดส่ง  : อยู่ในฉบับร่างเที่ยวขนส่ง (ล็อกไว้ เลือกซ้ำไม่ได้ จนกว่าจะบันทึกเป็นเที่ยวหรือลบฉบับร่าง)
// วันเดียวกันที่มีทั้งสองสถานะ แยกเป็น 2 รายการ (เช่น 1,000 กก.: กำลังจัดส่ง 800 กก. · รอจัดส่ง 200 กก.) — แต่ละรายการมีป้ายสถานะก่อนกางดูใบ
// ใบที่มียางก้อนถ้วยกับขี้ฟองปนกัน แยกตามส่วนที่ถูกล็อก (ประเภทใดอยู่ในฉบับร่างก็นับเป็นกำลังจัดส่งเฉพาะประเภทนั้น)
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { stockService } from '@/services/stockService'
import { transportDraftService } from '@/services/transportService'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'
import { formatKg, formatMoney, formatNumber } from '@/utils/format'

const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('transport.create'))
const canSeeDrafts = computed(() => auth.can('transport.read'))

const data = ref(null)
const drafts = ref([])
const loading = ref(false)
const error = ref('')
const filter = ref('all') // all | SAME_DAY | OVERNIGHT
const statusFilter = ref('all') // all | waiting | shipping
const picked = ref(new Set())
const busy = ref(false)
const open = ref(new Set()) // รายการที่กางดูใบ: `${date}:${status}`

async function load() {
  if (!data.value) loading.value = true
  try {
    data.value = await stockService.unsold()
    error.value = ''
    if (canSeeDrafts.value) { try { drafts.value = await transportDraftService.list() } catch { /* ไม่มีสิทธิ์/โหลดไม่ได้: แค่ไม่แสดงชื่อฉบับร่าง */ } }
  } catch (e) { error.value = getErrorMessage(e, 'โหลดยางรอขายไม่สำเร็จ') } finally { loading.value = false }
}
// สถานะ รอจัดส่ง/กำลังจัดส่ง เปลี่ยนได้จากหน้าการขนส่ง — ดึงใหม่ทุก 10 วินาทีขณะเปิดหน้านี้
let timer
const tick = () => { if (document.visibilityState === 'visible' && !busy.value) load() }
onMounted(() => { load(); timer = setInterval(tick, 10000); document.addEventListener('visibilitychange', tick) })
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) })

const STATUS = {
  shipping: { label: 'กำลังจัดส่ง', icon: 'truck', hint: 'อยู่ในฉบับร่างเที่ยวขนส่ง — ล็อกไว้แล้ว' },
  waiting: { label: 'รอจัดส่ง', icon: 'clock', hint: 'ยังไม่ได้เลือกไปในฉบับร่างเที่ยวขนส่ง' },
}
const LABEL = { SAME_DAY: 'ขายต่อวัน', OVERNIGHT: 'ค้างคืน' }
const draftById = computed(() => new Map(drafts.value.map((d) => [d.id, d])))
const draftName = (id) => {
  const d = draftById.value.get(id)
  const p = d?.payload ?? {}
  return d ? `ร่าง ${p.date ? formatThaiDate(p.date) : ''} · ${p.productType === 'FOAM' ? 'ขี้ฟอง' : 'ก้อนถ้วย'}`.trim() : 'ฉบับร่างเที่ยวขนส่ง'
}

// ใบ 1 ใบ แยกเป็น 2 ส่วน: ส่วนที่ถูกล็อกในฉบับร่าง (กำลังจัดส่ง) และส่วนที่เหลือ (รอจัดส่ง)
function split(b) {
  const sCup = b.cupLock ? b.cupKg : 0, sFoam = b.foamLock ? b.foamKg : 0
  return {
    shipping: { cup: sCup, foam: sFoam, cost: (b.cupLock ? b.cupCost : 0) + (b.foamLock ? b.foamCost : 0), drafts: [...new Set([b.cupLock, b.foamLock].filter(Boolean))] },
    waiting: { cup: b.cupKg - sCup, foam: b.foamKg - sFoam, cost: (b.cupLock ? 0 : b.cupCost) + (b.foamLock ? 0 : b.foamCost), drafts: [] },
  }
}
const has = (x) => x.cup + x.foam > 0.004

const days = computed(() => (data.value?.days ?? [])
  .map((d) => {
    const bills = d.bills.filter((b) => filter.value === 'all' || b.hold === filter.value)
    const groups = ['shipping', 'waiting']
      .filter((st) => statusFilter.value === 'all' || statusFilter.value === st)
      .map((st) => {
        const rows = bills.map((b) => ({ b, ...split(b)[st] })).filter(has)
        return { key: `${d.date}:${st}`, status: st, rows, cup: rows.reduce((a, r) => a + r.cup, 0), foam: rows.reduce((a, r) => a + r.foam, 0), cost: rows.reduce((a, r) => a + r.cost, 0),
          night: rows.filter((r) => r.b.hold === 'OVERNIGHT').length, same: rows.filter((r) => r.b.hold !== 'OVERNIGHT').length }
      })
      .filter((g) => g.rows.length)
    return { date: d.date, groups, cup: groups.reduce((a, g) => a + g.cup, 0), foam: groups.reduce((a, g) => a + g.foam, 0) }
  })
  .filter((d) => d.groups.length))
const shownCount = computed(() => days.value.reduce((a, d) => a + d.groups.reduce((x, g) => x + g.rows.length, 0), 0))
const sum = computed(() => data.value?.summary)
// ภาพรวมตามสถานะการขาย (ทุกวัน · ตามตัวกรองขายต่อวัน/ค้างคืน)
const stat = computed(() => {
  const out = { shipping: { bills: 0, cup: 0, foam: 0 }, waiting: { bills: 0, cup: 0, foam: 0 } }
  for (const d of data.value?.days ?? []) for (const b of d.bills) {
    if (filter.value !== 'all' && b.hold !== filter.value) continue
    const sp = split(b)
    for (const st of ['shipping', 'waiting']) if (has(sp[st])) { out[st].bills++; out[st].cup += sp[st].cup; out[st].foam += sp[st].foam }
  }
  return out
})

const toggleOpen = (key) => { const s = new Set(open.value); s.has(key) ? s.delete(key) : s.add(key); open.value = s }
const toggleBill = (id) => { const s = new Set(picked.value); s.has(id) ? s.delete(id) : s.add(id); picked.value = s }
const groupAll = (g) => g.rows.every((r) => picked.value.has(r.b.id))
function toggleGroup(g) { const s = new Set(picked.value); const all = groupAll(g); for (const r of g.rows) all ? s.delete(r.b.id) : s.add(r.b.id); picked.value = s }

async function setHold(ids, status, label) {
  if (!ids.length || busy.value) return
  busy.value = true
  try {
    const r = await stockService.setHold(ids, status)
    toast.success(r.updated ? `ตั้ง ${r.updated} ใบเป็น “${label}” แล้ว` : 'สถานะเป็นแบบนี้อยู่แล้ว')
    picked.value = new Set()
    await load()
  } catch (e) { toast.error(getErrorMessage(e, 'เปลี่ยนสถานะไม่สำเร็จ')) } finally { busy.value = false }
}
const flip = (b) => (b.hold === 'OVERNIGHT' ? 'SAME_DAY' : 'OVERNIGHT')
</script>

<template>
  <section class="stk">
    <header class="head">
      <div>
        <h1>ยางรอขาย</h1>
        <p>ยางที่รับซื้อแล้วแต่ยังไม่ได้ขายให้โรงงาน · แยกตามสถานะ <b>รอจัดส่ง</b> / <b>กำลังจัดส่ง</b> (อยู่ในฉบับร่างเที่ยวขนส่ง) · เปลี่ยน ขายต่อวัน ⇄ ค้างคืน ได้ตลอดสำหรับยางที่รอจัดส่ง</p>
      </div>
      <div class="tools">
        <div class="seg" role="group" aria-label="กรองสถานะการขาย">
          <button type="button" :class="{ on: statusFilter === 'all' }" @click="statusFilter = 'all'">ทุกสถานะ</button>
          <button type="button" :class="{ on: statusFilter === 'waiting' }" @click="statusFilter = 'waiting'">รอจัดส่ง</button>
          <button type="button" :class="{ on: statusFilter === 'shipping' }" @click="statusFilter = 'shipping'">กำลังจัดส่ง</button>
        </div>
        <div class="seg" role="group" aria-label="กรองขายต่อวัน/ค้างคืน">
          <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">ทั้งหมด</button>
          <button type="button" :class="{ on: filter === 'SAME_DAY' }" @click="filter = 'SAME_DAY'">ขายต่อวัน</button>
          <button type="button" :class="{ on: filter === 'OVERNIGHT' }" @click="filter = 'OVERNIGHT'">ค้างคืน</button>
        </div>
        <RouterLink to="/transport" class="link"><AppIcon name="plus" :size="14" /> บันทึกการขายให้โรงงาน</RouterLink>
      </div>
    </header>

    <p v-if="error" class="err" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>

    <div v-if="sum" class="tiles">
      <div class="tile tile--wait"><small><AppIcon name="clock" :size="12" /> รอจัดส่ง · {{ stat.waiting.bills }} ใบ</small><b>{{ formatKg(stat.waiting.cup) }}</b><em>ก้อนถ้วย · ขี้ฟอง {{ formatKg(stat.waiting.foam) }}</em></div>
      <div class="tile tile--ship"><small><AppIcon name="truck" :size="12" /> กำลังจัดส่ง · {{ stat.shipping.bills }} ใบ</small><b>{{ formatKg(stat.shipping.cup) }}</b><em>ก้อนถ้วย · ขี้ฟอง {{ formatKg(stat.shipping.foam) }}</em></div>
      <div class="tile tile--day"><small>ขายต่อวัน · {{ sum.sameDay.bills }} ใบ</small><b>{{ formatKg(sum.sameDay.cupKg) }}</b>
        <em>ก้อนถ้วย · ขี้ฟอง {{ formatKg(sum.sameDay.foamKg) }} · ต้นทุน {{ formatMoney(sum.sameDay.cost) }}</em></div>
      <div class="tile tile--night"><small>ค้างคืน · {{ sum.overnight.bills }} ใบ</small><b>{{ formatKg(sum.overnight.cupKg) }}</b>
        <em>ก้อนถ้วย · ขี้ฟอง {{ formatKg(sum.overnight.foamKg) }} · ต้นทุน {{ formatMoney(sum.overnight.cost) }}</em></div>
    </div>

    <div v-if="canEdit && picked.size" class="bar" role="toolbar" aria-label="จัดการใบที่เลือก">
      <b>เลือก {{ picked.size }} ใบ</b>
      <BaseButton size="sm" variant="soft" :loading="busy" @click="setHold([...picked], 'SAME_DAY', 'ขายต่อวัน')">ตั้งเป็นขายต่อวัน</BaseButton>
      <BaseButton size="sm" :loading="busy" @click="setHold([...picked], 'OVERNIGHT', 'ค้างคืน')">ตั้งเป็นค้างคืน</BaseButton>
      <button type="button" class="clear" @click="picked = new Set()">ล้างที่เลือก</button>
    </div>

    <p v-if="loading && !data" class="empty">กำลังโหลด…</p>
    <p v-else-if="data && !shownCount" class="empty">ไม่มียางรอขาย{{ statusFilter !== 'all' ? ` ในสถานะ “${STATUS[statusFilter].label}”` : '' }}{{ filter !== 'all' ? ` (${LABEL[filter]})` : '' }}{{ statusFilter === 'all' && filter === 'all' ? ' — ยางที่รับซื้อทั้งหมดขายให้โรงงานแล้ว' : '' }}</p>

    <ul class="days">
      <li v-for="d in days" :key="d.date" class="day">
        <div class="day__row">
          <span class="day__name">ซื้อวันที่ <b>{{ formatThaiDate(d.date) }}</b></span>
          <span class="day__kg">รวม ก้อนถ้วย <b>{{ formatNumber(d.cup) }}</b> กก.<template v-if="d.foam > 0"> · ขี้ฟอง <b>{{ formatNumber(d.foam) }}</b> กก.</template></span>
        </div>

        <!-- 1 วัน แยกเป็นรายการตามสถานะ: ป้ายสถานะอยู่หน้าสุด ดูได้ก่อนกางรายละเอียด -->
        <ul class="grps">
          <li v-for="g in d.groups" :key="g.key" class="grp" :class="`grp--${g.status}`">
            <div class="grp__row">
              <input v-if="canEdit && g.status === 'waiting'" type="checkbox" :checked="groupAll(g)" :aria-label="`เลือกทุกใบที่รอจัดส่งของวันที่ ${formatThaiDate(d.date)}`" @change="toggleGroup(g)" />
              <span v-else class="ck-gap" aria-hidden="true" />
              <span class="st" :class="`st--${g.status}`" :title="STATUS[g.status].hint"><AppIcon :name="STATUS[g.status].icon" :size="12" /> {{ STATUS[g.status].label }}</span>
              <button type="button" class="grp__name" :aria-expanded="open.has(g.key)" @click="toggleOpen(g.key)">
                <span class="chev" :class="{ up: open.has(g.key) }">▸</span> {{ g.rows.length }} ใบ
              </button>
              <span v-if="g.same" class="chip">ขายต่อวัน {{ g.same }}</span>
              <span v-if="g.night" class="chip chip--night">ค้างคืน {{ g.night }}</span>
              <span class="day__kg">ก้อนถ้วย <b>{{ formatNumber(g.cup) }}</b> กก.<template v-if="g.foam > 0"> · ขี้ฟอง <b>{{ formatNumber(g.foam) }}</b> กก.</template> · ต้นทุน {{ formatMoney(g.cost) }}</span>
              <span v-if="canEdit && g.status === 'waiting'" class="day__act">
                <button type="button" :disabled="busy" @click="setHold(g.rows.map((r) => r.b.id), 'SAME_DAY', 'ขายต่อวัน')">ทั้งรายการ → ขายต่อวัน</button>
                <button type="button" :disabled="busy" @click="setHold(g.rows.map((r) => r.b.id), 'OVERNIGHT', 'ค้างคืน')">ทั้งรายการ → ค้างคืน</button>
              </span>
              <RouterLink v-else-if="g.status === 'shipping'" to="/transport" class="goto">ไปที่ฉบับร่าง</RouterLink>
            </div>
            <table v-if="open.has(g.key)" class="tb">
              <thead><tr><th v-if="canEdit" /><th>ใบรับซื้อ</th><th>ลูกค้า</th><th class="r">ก้อนถ้วย (กก.)</th><th class="r">ขี้ฟอง (กก.)</th><th class="r">ต้นทุน</th><th>สถานะ</th></tr></thead>
              <tbody>
                <tr v-for="r in g.rows" :key="r.b.id">
                  <td v-if="canEdit" class="ck"><input v-if="g.status === 'waiting'" type="checkbox" :checked="picked.has(r.b.id)" :aria-label="`เลือกใบ ${r.b.no}`" @change="toggleBill(r.b.id)" /></td>
                  <td><b>{{ r.b.no }}</b><br /><small>{{ r.b.time }} น.</small></td>
                  <td>{{ r.b.customer }}</td>
                  <td class="r">{{ r.cup > 0 ? formatNumber(r.cup) : '–' }}</td>
                  <td class="r">{{ r.foam > 0 ? formatNumber(r.foam) : '–' }}</td>
                  <td class="r">{{ formatMoney(r.cost) }}</td>
                  <td>
                    <span class="st st--sm" :class="`st--${g.status}`">{{ STATUS[g.status].label }}</span>
                    <span class="chip" :class="{ 'chip--night': r.b.hold === 'OVERNIGHT' }">{{ LABEL[r.b.hold] }}</span>
                    <span v-if="r.b.partial" class="chip chip--part" title="ขายไปบางส่วนแล้ว เช่น ขายยางก้อนถ้วยแล้ว เหลือขี้ฟอง">ขายบางส่วนแล้ว</span>
                    <small v-for="id in r.drafts" :key="id" class="dname">{{ draftName(id) }}</small>
                    <button v-if="canEdit && g.status === 'waiting'" type="button" class="flip" :disabled="busy" @click="setHold([r.b.id], flip(r.b), LABEL[flip(r.b)])">เปลี่ยนเป็น{{ LABEL[flip(r.b)] }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.stk { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 0; overflow-y: auto; padding-bottom: 12px; }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.head h1 { font-size: 28px; font-weight: 800; letter-spacing: -.5px; color: var(--slate-900); } .head p { font-size: 12px; color: var(--slate-500); margin-top: 2px; max-width: 640px; }
.tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.seg { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; }
.seg button { padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); } .seg button.on { background: var(--blue-50); color: var(--blue-700); font-weight: 700; }
.link { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-md); background: var(--blue-600); color: #fff; font-size: 12px; font-weight: 700; text-decoration: none; }
.err { font-size: 12px; color: #dc2626; } .err button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
.tile { padding: 10px 14px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); border-left: 4px solid #2563eb; display: flex; flex-direction: column; gap: 2px; }
.tile--night { border-left-color: #7c3aed; } .tile small { font-size: 11px; font-weight: 700; color: var(--slate-600); } .tile b { font-size: 22px; font-weight: 800; color: var(--slate-900); } .tile em { font-style: normal; font-size: 11px; color: var(--slate-500); }
.bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); box-shadow: var(--shadow-panel); font-size: 13px; color: var(--blue-700); }
.clear { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--slate-500); }
.empty { font-size: 13px; color: var(--slate-500); padding: 20px 4px; }
.days { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.day { border: 1px solid var(--slate-100); border-radius: var(--radius-md); background: #fff; overflow: hidden; }
.day__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; font-size: 12px; color: var(--slate-600); }
.day__name { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--slate-800); } .day__name b { font-weight: 800; }
.chev { display: inline-block; font-size: 10px; transition: transform .15s; } .chev.up { transform: rotate(90deg); }
.day__kg { margin-left: auto; font-variant-numeric: tabular-nums; } .day__kg b { color: var(--slate-900); }
.day__act { display: inline-flex; gap: 12px; } .day__act button { font-size: 11px; font-weight: 700; color: var(--blue-700); } .day__act button:disabled { opacity: .5; }
.chip { padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: var(--blue-50); color: var(--blue-700); border: 1px solid var(--blue-100); white-space: nowrap; }
.chip--night { background: #f5f3ff; color: #6d28d9; border-color: #c4b5fd; } .chip--part { background: #f0fdf4; color: #15803d; border-color: #86efac; margin-left: 4px; }
.tb { width: 100%; border-collapse: collapse; font-size: 12px; border-top: 1px solid var(--slate-100); }
.tb th { text-align: left; padding: 6px 12px; font-size: 11px; color: var(--slate-500); background: var(--slate-50); white-space: nowrap; } .tb td { padding: 6px 12px; border-top: 1px solid var(--slate-100); color: var(--slate-800); font-variant-numeric: tabular-nums; vertical-align: middle; }
.tb .r { text-align: right; } .tb small { color: var(--slate-400); } .ck { width: 32px; }
.flip { margin-left: 8px; font-size: 11px; font-weight: 600; color: var(--blue-700); text-decoration: underline; } .flip:disabled { opacity: .5; }
.tile--wait { border-left-color: #d97706; } .tile--ship { border-left-color: #2563eb; }
.tile small { display: inline-flex; align-items: center; gap: 5px; }
.grps { list-style: none; margin: 0; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.grp { border: 1px solid var(--slate-100); border-radius: 10px; overflow: hidden; border-left: 4px solid var(--slate-300); }
.grp--shipping { border-left-color: #2563eb; background: #f8fbff; } .grp--waiting { border-left-color: #d97706; }
.grp__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; font-size: 12px; color: var(--slate-600); }
.grp__name { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--slate-800); }
.ck-gap { display: inline-block; width: 13px; }
.st { display: inline-flex; align-items: center; gap: 5px; padding: 3px 11px; border-radius: 9999px; font-size: 11.5px; font-weight: 800; border: 1px solid; white-space: nowrap; }
.st--waiting { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; }
.st--shipping { background: var(--blue-50); color: var(--blue-700); border-color: #93c5fd; }
.st--sm { padding: 1px 8px; font-size: 10.5px; margin-right: 4px; }
.goto { margin-left: 8px; font-size: 11px; font-weight: 700; color: var(--blue-700); text-decoration: underline; }
.dname { display: block; margin-top: 2px; color: var(--blue-700) !important; }
</style>

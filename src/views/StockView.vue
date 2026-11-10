<script setup>
// ยางรอขาย: ยางที่รับซื้อแล้วแต่ยังไม่ได้ขายให้โรงงาน — จัดกลุ่มตามวันที่ซื้อ
//   สถานะยาง ขายต่อวัน ⇄ ค้างคืน เปลี่ยนได้ตลอด (ทีละใบ / เลือกหลายใบ / ทั้งวัน) จนกว่าจะบันทึกขายในเมนู "การขนส่ง"
//   แสดงเฉพาะที่ยังไม่ได้ขาย · ขี้ฟองที่ไม่ได้นับตอนขายยางก้อนถ้วย จะยังค้างอยู่ที่นี่
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { stockService } from '@/services/stockService'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'
import { formatKg, formatMoney, formatNumber } from '@/utils/format'

const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('transport.create'))

const data = ref(null)
const loading = ref(false)
const error = ref('')
const filter = ref('all') // all | SAME_DAY | OVERNIGHT
const picked = ref(new Set())
const busy = ref(false)
const open = ref(new Set()) // วันที่กางดูใบ

async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await stockService.unsold() } catch (e) { error.value = getErrorMessage(e, 'โหลดยางรอขายไม่สำเร็จ') } finally { loading.value = false }
}
onMounted(load)

const days = computed(() => (data.value?.days ?? [])
  .map((d) => ({ ...d, shown: d.bills.filter((b) => filter.value === 'all' || b.hold === filter.value) }))
  .filter((d) => d.shown.length))
const shownCount = computed(() => days.value.reduce((a, d) => a + d.shown.length, 0))
const sum = computed(() => data.value?.summary)

const toggleOpen = (date) => { const s = new Set(open.value); s.has(date) ? s.delete(date) : s.add(date); open.value = s }
const toggleBill = (id) => { const s = new Set(picked.value); s.has(id) ? s.delete(id) : s.add(id); picked.value = s }
const dayAll = (d) => d.shown.every((b) => picked.value.has(b.id))
function toggleDay(d) { const s = new Set(picked.value); const all = dayAll(d); for (const b of d.shown) all ? s.delete(b.id) : s.add(b.id); picked.value = s }

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
const LABEL = { SAME_DAY: 'ขายต่อวัน', OVERNIGHT: 'ค้างคืน' }
const flip = (b) => (b.hold === 'OVERNIGHT' ? 'SAME_DAY' : 'OVERNIGHT')
</script>

<template>
  <section class="stk">
    <header class="head">
      <div>
        <h1>ยางรอขาย</h1>
        <p>ยางที่รับซื้อแล้วแต่ยังไม่ได้ขายให้โรงงาน · เปลี่ยนสถานะ ขายต่อวัน ⇄ ค้างคืน ได้ตลอด แล้วไปเลือกยางตอนบันทึกขายที่เมนู “การขนส่ง”</p>
      </div>
      <div class="tools">
        <div class="seg" role="group" aria-label="กรองสถานะ">
          <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">ทั้งหมด</button>
          <button type="button" :class="{ on: filter === 'SAME_DAY' }" @click="filter = 'SAME_DAY'">ขายต่อวัน</button>
          <button type="button" :class="{ on: filter === 'OVERNIGHT' }" @click="filter = 'OVERNIGHT'">ค้างคืน</button>
        </div>
        <RouterLink to="/transport" class="link"><AppIcon name="plus" :size="14" /> บันทึกการขายให้โรงงาน</RouterLink>
      </div>
    </header>

    <p v-if="error" class="err" role="alert">{{ error }} <button type="button" @click="load">ลองใหม่</button></p>

    <div v-if="sum" class="tiles">
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
    <p v-else-if="data && !shownCount" class="empty">ไม่มียางรอขาย{{ filter !== 'all' ? ` ในสถานะ “${LABEL[filter]}”` : '' }} — ยางที่รับซื้อทั้งหมดขายให้โรงงานแล้ว</p>

    <ul class="days">
      <li v-for="d in days" :key="d.date" class="day">
        <div class="day__row">
          <input v-if="canEdit" type="checkbox" :checked="dayAll(d)" :aria-label="`เลือกทุกใบของวันที่ ${formatThaiDate(d.date)}`" @change="toggleDay(d)" />
          <button type="button" class="day__name" :aria-expanded="open.has(d.date)" @click="toggleOpen(d.date)">
            <span class="chev" :class="{ up: open.has(d.date) }">▸</span> ซื้อวันที่ <b>{{ formatThaiDate(d.date) }}</b>
          </button>
          <span v-if="d.sameDay.bills" class="chip">ขายต่อวัน {{ d.sameDay.bills }} ใบ</span>
          <span v-if="d.overnight.bills" class="chip chip--night">ค้างคืน {{ d.overnight.bills }} ใบ</span>
          <span class="day__kg">ก้อนถ้วย <b>{{ formatNumber(d.shown.reduce((a, b) => a + b.cupKg, 0)) }}</b> กก.<template v-if="d.shown.some((b) => b.foamKg > 0)"> · ขี้ฟอง <b>{{ formatNumber(d.shown.reduce((a, b) => a + b.foamKg, 0)) }}</b> กก.</template></span>
          <span v-if="canEdit" class="day__act">
            <button type="button" :disabled="busy" @click="setHold(d.shown.map((b) => b.id), 'SAME_DAY', 'ขายต่อวัน')">ทั้งวัน → ขายต่อวัน</button>
            <button type="button" :disabled="busy" @click="setHold(d.shown.map((b) => b.id), 'OVERNIGHT', 'ค้างคืน')">ทั้งวัน → ค้างคืน</button>
          </span>
        </div>
        <table v-if="open.has(d.date)" class="tb">
          <thead><tr><th v-if="canEdit" /><th>ใบรับซื้อ</th><th>ลูกค้า</th><th class="r">ก้อนถ้วย (กก.)</th><th class="r">ขี้ฟอง (กก.)</th><th class="r">ต้นทุน</th><th>สถานะ</th></tr></thead>
          <tbody>
            <tr v-for="b in d.shown" :key="b.id">
              <td v-if="canEdit" class="ck"><input type="checkbox" :checked="picked.has(b.id)" :aria-label="`เลือกใบ ${b.no}`" @change="toggleBill(b.id)" /></td>
              <td><b>{{ b.no }}</b><br /><small>{{ b.time }} น.</small></td>
              <td>{{ b.customer }}</td>
              <td class="r">{{ formatNumber(b.cupKg) }}</td>
              <td class="r">{{ b.foamKg > 0 ? formatNumber(b.foamKg) : '–' }}</td>
              <td class="r">{{ formatMoney(b.cupCost + b.foamCost) }}</td>
              <td>
                <span class="chip" :class="{ 'chip--night': b.hold === 'OVERNIGHT' }">{{ LABEL[b.hold] }}</span>
                <span v-if="b.partial" class="chip chip--part" title="ขายไปบางส่วนแล้ว เช่น ขายยางก้อนถ้วยแล้ว เหลือขี้ฟอง">ขายบางส่วนแล้ว</span>
                <button v-if="canEdit" type="button" class="flip" :disabled="busy" @click="setHold([b.id], flip(b), LABEL[flip(b)])">เปลี่ยนเป็น{{ LABEL[flip(b)] }}</button>
              </td>
            </tr>
          </tbody>
        </table>
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
</style>

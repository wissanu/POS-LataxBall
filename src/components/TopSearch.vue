<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useOrderStore } from '@/stores/orders'
import { useSearchStore } from '@/stores/search'
import { orderService } from '@/services/orderService'
import { addDays, bangkokDate } from '@/utils/dates'
import { firstLetter } from '@/utils/format'

/**
 * ช่องค้นหาด้านบน — ใช้ได้เฉพาะ 2 หน้า
 *   Order List : ค้นหา (1) ลูกค้า — พิมพ์ชื่อแล้วเลือกจาก dropdown (ชื่อซ้ำได้ จึงแสดงรหัส/เบอร์/ที่อยู่ให้แยกกัน)
 *                      (2) ช่วงวันเวลา  (3) เลขที่ใบรับซื้อ  — ผลค้นข้ามทุกวัน
 *   New Order  : กรองรายการเกรด (A+, B, C+ …) ในหน้าจอ
 *   หน้าอื่น    : ปิดการใช้งาน
 */
const route = useRoute()
const orders = useOrderStore()
const find = useSearchStore()

const mode = computed(() => (route.name === 'orders' ? 'orders' : route.name === 'new-order' ? 'grades' : 'off'))
const placeholder = computed(() => ({
  orders: 'ค้นหาลูกค้า / เลขที่ใบรับซื้อ / ช่วงวันเวลา',
  grades: 'ค้นหาเกรด เช่น A+, B, C+',
  off: 'ค้นหาได้ที่หน้า Order List และ New Order',
}[mode.value]))

const root = ref(null)
const open = ref(false)
const text = ref('')
const model = computed({
  get: () => (mode.value === 'grades' ? find.gradeQuery : text.value),
  set: (v) => { if (mode.value === 'grades') find.gradeQuery = v; else text.value = v },
})

// เปลี่ยนหน้า: ล้างข้อความค้นหาของหน้าเดิม
watch(mode, (m, prev) => {
  open.value = false
  text.value = ''
  results.value = []
  if (prev === 'grades') find.clearGrade()
})

// ---- ลูกค้า (Order List) ----
const results = ref([])
const searching = ref(false)
const active = ref(-1) // ตัวที่ไฮไลต์ด้วยคีย์บอร์ด: 0 = เลขที่ใบรับซื้อ (ถ้ามีข้อความ) แล้วตามด้วยลูกค้า
let timer = null
let reqSeq = 0
watch(text, (v) => {
  clearTimeout(timer)
  active.value = -1
  const q = v.trim()
  if (!q || mode.value !== 'orders') { results.value = []; searching.value = false; return }
  searching.value = true
  timer = setTimeout(async () => {
    const mine = ++reqSeq
    try {
      const r = await orderService.customers(q)
      if (mine === reqSeq) results.value = r
    } catch {
      if (mine === reqSeq) results.value = []
    } finally {
      if (mine === reqSeq) searching.value = false
    }
  }, 250)
})

const noText = computed(() => text.value.trim().replace(/^#/, ''))
const rows = computed(() => [...(noText.value ? [{ kind: 'no' }] : []), ...results.value.map((c) => ({ kind: 'customer', c }))])

function pickCustomer(c) {
  orders.applySearch({ customer: { id: c.id, name: c.name, code: c.code, type: c.type } })
  text.value = ''
  open.value = false
}
function applyNo() {
  if (!noText.value) return
  orders.applySearch({ no: noText.value })
  text.value = ''
  open.value = false
}
function choose(row) { row.kind === 'no' ? applyNo() : pickCustomer(row.c) }
function onKey(e) {
  if (mode.value !== 'orders') return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!rows.value.length) return
    e.preventDefault()
    open.value = true
    const n = rows.value.length
    active.value = e.key === 'ArrowDown' ? (active.value + 1) % n : (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    // เลือกด้วยลูกศรแล้วกด Enter = ตัวที่ไฮไลต์ · ไม่ได้เลือก: มีตัวเลข = เลขที่ใบรับซื้อ · ไม่มีตัวเลขและเจอลูกค้า 1 คน = คนนั้น (หลายคนต้องเลือกเอง)
    const picked = rows.value[active.value]
    if (picked) choose(picked)
    else if (/\d/.test(noText.value)) applyNo()
    else if (results.value.length === 1) pickCustomer(results.value[0])
  }
}

// ---- ช่วงวันเวลา (เวลาไทย) ----
const from = ref('')
const to = ref('')
const rangeError = computed(() => (from.value && to.value && from.value > to.value ? 'วันเวลาเริ่มต้นต้องไม่เกินวันเวลาสิ้นสุด' : ''))
const canApplyRange = computed(() => (from.value || to.value) && !rangeError.value)
function preset(days) {
  const today = bangkokDate()
  from.value = `${addDays(today, -(days - 1))}T00:00`
  to.value = `${today}T23:59`
}
function applyRange() {
  if (!canApplyRange.value) return
  orders.applySearch({ from: from.value, to: to.value })
  open.value = false
}

// เปิด dropdown: ซิงก์ช่วงเวลากับที่ใช้อยู่
function openPop() {
  if (mode.value !== 'orders') return
  from.value = orders.search.from
  to.value = orders.search.to
  open.value = true
}
function clearInput() {
  model.value = ''
  active.value = -1
}

function onPointerDown(e) { if (open.value && !root.value?.contains(e.target)) open.value = false }
function onEsc(e) { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('pointerdown', onPointerDown); document.addEventListener('keydown', onEsc) })
onBeforeUnmount(() => {
  clearTimeout(timer)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <div ref="root" class="ts">
    <label class="search" :class="{ 'search--off': mode === 'off' }" :title="mode === 'off' ? placeholder : undefined">
      <AppIcon name="search" />
      <input
        v-model="model" type="search" autocomplete="off" :placeholder="placeholder" :disabled="mode === 'off'" aria-label="ค้นหา"
        :aria-expanded="mode === 'orders' ? open : undefined" :aria-haspopup="mode === 'orders' ? 'listbox' : undefined"
        @focus="openPop" @input="mode === 'orders' && !open && openPop()" @keydown="onKey"
      />
      <button v-if="mode === 'grades' && find.gradeQuery" type="button" class="search__x" aria-label="ล้างคำค้นหา" @click="clearInput"><AppIcon name="x" :size="12" /></button>
    </label>

    <div v-if="open && mode === 'orders'" class="pop" role="dialog" aria-label="ตัวเลือกการค้นหาใบรับซื้อ">
      <section v-if="noText || text.trim()" class="sec">
        <h5>เลขที่ใบรับซื้อ</h5>
        <button type="button" class="row" :class="{ 'row--on': active === 0 }" @click="applyNo">
          <span class="ico"><AppIcon name="receipt" :size="15" /></span>
          <span class="row__main"><b>ค้นหาเลขที่ “{{ noText }}”</b><small>เช่น 0011 หรือ B01-PUR-20261013-0011</small></span>
        </button>
      </section>

      <section class="sec">
        <h5>ลูกค้า <small>(เลือกเพื่อดูใบรับซื้อของลูกค้าคนนั้นทั้งหมด)</small></h5>
        <p v-if="!text.trim()" class="hint">พิมพ์ชื่อ รหัส หรือเบอร์โทรลูกค้า</p>
        <p v-else-if="searching" class="hint">กำลังค้นหา…</p>
        <p v-else-if="!results.length" class="hint">ไม่พบลูกค้าที่ตรงกับ “{{ text.trim() }}”</p>
        <ul v-else class="list" role="listbox">
          <li v-for="(c, i) in results" :key="c.id">
            <button type="button" class="row" role="option" :class="{ 'row--on': active === i + (noText ? 1 : 0) }" @click="pickCustomer(c)">
              <span class="av">{{ firstLetter(c.name) }}</span>
              <span class="row__main">
                <b>{{ c.name }}</b>
                <small>{{ c.type === 'general' ? 'ลูกค้าทั่วไป (ไม่ใช่ลูกค้าประจำ)' : [c.code, c.phone, c.address].filter(Boolean).join(' · ') }}</small>
              </span>
              <span class="cnt">{{ c.orderCount }} ใบ</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="sec">
        <h5>ช่วงวันเวลา <small>(เวลาไทย)</small></h5>
        <div class="presets">
          <button type="button" @click="preset(1)">วันนี้</button>
          <button type="button" @click="preset(7)">7 วันล่าสุด</button>
          <button type="button" @click="preset(30)">30 วันล่าสุด</button>
        </div>
        <div class="range">
          <label>ตั้งแต่<input v-model="from" type="datetime-local" /></label>
          <label>ถึง<input v-model="to" type="datetime-local" /></label>
        </div>
        <p v-if="rangeError" class="err" role="alert">{{ rangeError }}</p>
        <button type="button" class="apply" :disabled="!canApplyRange" @click="applyRange">แสดงใบรับซื้อในช่วงนี้</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ts { position: relative; }
.search { display: flex; align-items: center; gap: 8px; width: 280px; height: 30px; padding: 0 12px; border-radius: 9999px; background: rgba(255, 255, 255, .7); border: 1px solid #fff; color: var(--slate-400); }
.search:focus-within { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
.search--off { opacity: .6; cursor: not-allowed; }
.search input { border: 0; background: none; outline: none; font-size: 12px; flex: 1; min-width: 0; color: var(--slate-800); }
.search input:disabled { cursor: not-allowed; }
.search input::-webkit-search-cancel-button { display: none; }
.search__x { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: var(--slate-200); color: var(--slate-600); }
.search__x:hover { background: var(--slate-300); }

.pop { position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; width: 400px; max-width: calc(100vw - 32px); max-height: min(70vh, 560px); overflow-y: auto; padding: 6px 12px 12px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); box-shadow: var(--shadow-panel); }
.sec { padding: 10px 0; border-bottom: 1px solid var(--slate-100); }
.sec:last-child { border-bottom: 0; padding-bottom: 0; }
h5 { font-size: 11px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: var(--slate-500); margin-bottom: 6px; }
h5 small { text-transform: none; font-weight: 500; letter-spacing: 0; color: var(--slate-400); }
.hint { font-size: 12px; color: var(--slate-400); padding: 4px 2px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.row { width: 100%; display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: var(--radius-sm); text-align: left; }
.row:hover, .row--on { background: var(--blue-50); }
.row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.row__main b { font-size: 13px; font-weight: 600; color: var(--slate-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row__main small { font-size: 11px; color: var(--slate-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ico, .av { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.ico { background: var(--slate-100); color: var(--slate-600); }
.av { background: var(--blue-100); color: var(--blue-700); }
.cnt { flex: none; font-size: 11px; font-weight: 600; color: var(--slate-500); background: var(--slate-100); padding: 2px 8px; border-radius: 9999px; }

.presets { display: flex; gap: 6px; margin-bottom: 8px; }
.presets button { padding: 4px 10px; border-radius: 9999px; border: 1px solid var(--slate-200); font-size: 11px; font-weight: 600; color: var(--slate-600); }
.presets button:hover { border-color: #93c5fd; color: var(--blue-700); background: var(--blue-50); }
.range { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.range label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 600; color: var(--slate-500); }
.range input { height: 32px; padding: 0 8px; border: 1px solid var(--slate-200); border-radius: var(--radius-sm); font-size: 12px; color: var(--slate-800); background: #fff; }
.range input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
.err { margin-top: 6px; font-size: 11px; color: #dc2626; }
.apply { margin-top: 10px; width: 100%; height: 34px; border-radius: var(--radius-md); background: var(--blue-600); color: #fff; font-size: 12px; font-weight: 600; }
.apply:disabled { opacity: .45; cursor: not-allowed; }
</style>

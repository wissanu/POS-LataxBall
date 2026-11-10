<script setup>
// popup สรุปผลการขนส่ง: เลือกได้ 2 แบบ — (1) เที่ยวที่ติ๊กเลือกในตาราง  (2) ช่วงวัน-เวลาออกเดินทาง
// ตัวเลขทั้งหมดคำนวณที่ API (GET /transports/summary) เพื่อให้ตรงกับรายการ/กราฟเสมอ
import { computed, reactive, ref, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { transportService } from '@/services/transportService'
import { getErrorMessage } from '@/services/http'
import { addDays, bangkokDate, formatThaiDate } from '@/utils/dates'
import { formatKg, formatNumber } from '@/utils/format'
import { formatDuration } from '@/utils/transport'

const props = defineProps({
  modelValue: Boolean,
  mode: { type: String, default: 'range' }, // 'selected' | 'range' — แท็บที่เปิดขึ้นมา
  ids: { type: Array, default: () => [] }, // id ของเที่ยวที่ติ๊กเลือก
  from: { type: String, default: '' }, // YYYY-MM-DD เริ่มต้นของช่วงวัน-เวลา
  to: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const toast = useToast()

const tab = ref('range')
const range = reactive({ from: '', to: '' }) // 'YYYY-MM-DDTHH:mm'
const data = ref(null)
const loading = ref(false)
const error = ref('')
let req = 0

const PRESETS = [
  { label: 'วันนี้', get: (t) => [t, t] },
  { label: '7 วันล่าสุด', get: (t) => [addDays(t, -6), t] },
  { label: '30 วันล่าสุด', get: (t) => [addDays(t, -29), t] },
  { label: 'เดือนนี้', get: (t) => [`${t.slice(0, 7)}-01`, t] },
]
function setRange(f, t) { range.from = `${f}T00:00`; range.to = `${t}T23:59` }
const applyPreset = (p) => setRange(...p.get(bangkokDate()))

const rangeError = computed(() => {
  if (tab.value !== 'range') return ''
  if (!range.from || !range.to) return 'เลือกวัน-เวลาเริ่มต้นและสิ้นสุด'
  if (range.from > range.to) return 'วัน-เวลาเริ่มต้นต้องไม่เกินวัน-เวลาสิ้นสุด'
  return ''
})
const noneSelected = computed(() => tab.value === 'selected' && !props.ids.length)

async function load() {
  if (!props.modelValue || rangeError.value || noneSelected.value) { data.value = null; error.value = ''; return }
  const id = ++req
  loading.value = true
  error.value = ''
  try {
    const params = tab.value === 'selected' ? { ids: props.ids.join(',') } : { from: range.from, to: range.to }
    const res = await transportService.summary(params)
    if (id === req) data.value = res
  } catch (e) {
    if (id === req) { data.value = null; error.value = getErrorMessage(e, 'โหลดสรุปผลไม่สำเร็จ') }
  } finally {
    if (id === req) loading.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (!open) return
  tab.value = props.mode === 'selected' && props.ids.length ? 'selected' : 'range'
  const t = bangkokDate()
  setRange(props.from || addDays(t, -29), props.to || t)
  data.value = null
  load()
})
watch([tab, () => range.from, () => range.to], load)

const empty = computed(() => data.value && data.value.trips === 0)
const pct = (n) => (n == null ? '–' : `${formatNumber(n)}%`)
const kg = (n) => (n == null ? '–' : formatKg(n))
const span = computed(() => {
  const d = data.value
  if (!d?.firstDate) return ''
  return d.firstDate === d.lastDate ? formatThaiDate(d.firstDate) : `${formatThaiDate(d.firstDate)} – ${formatThaiDate(d.lastDate)}`
})
const tripLabel = (t) => (t ? `${formatThaiDate(t.date)} เที่ยวที่ ${t.tripNo} · ${formatNumber(t.lossPct)}%` : '–')
const maxWindowPct = computed(() => Math.max(0.0001, ...(data.value?.windows ?? []).map((w) => Math.abs(w.lossPct ?? 0))))
const barW = (w) => `${Math.max(w.lossPct ? 4 : 0, (Math.abs(w.lossPct ?? 0) / maxWindowPct.value) * 100)}%`

const tiles = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { k: 'จำนวนเที่ยว', v: `${d.trips} เที่ยว`, s: span.value },
    { k: 'น้ำหนักที่ส่งรวม', v: kg(d.shippedKg), s: `เฉลี่ย ${kg(d.avgShippedKgPerTrip)}/เที่ยว` },
    { k: 'โรงงานชั่งได้รวม', v: kg(d.factoryNetKg) },
    { k: 'สูญเสียรวม', v: kg(d.lossKg), s: `เฉลี่ย ${kg(d.avgLossKgPerTrip)}/เที่ยว` },
    { k: 'สูญเสียเฉลี่ยรายเที่ยว', v: pct(d.avgLossPct), s: 'เฉลี่ยของ % แต่ละเที่ยว' },
    { k: 'ระยะเวลาขนส่งเฉลี่ย', v: formatDuration(d.avgDurationMin) },
    { k: 'สูญเสียเฉลี่ยต่อชั่วโมง', v: pct(d.avgLossPctPerHour) },
  ]
})

const scope = computed(() => (tab.value === 'selected' ? `${props.ids.length} เที่ยวที่เลือกในตาราง` : 'ตามช่วงวัน-เวลาออกเดินทาง'))

async function copy() {
  const d = data.value
  if (!d || !d.trips) return
  const lines = [
    `สรุปการขนส่งยางก้อนถ้วย (${scope.value})`,
    span.value && `วันที่: ${span.value}`,
    `จำนวน ${d.trips} เที่ยว · ส่งรวม ${kg(d.shippedKg)} · โรงงานชั่งได้ ${kg(d.factoryNetKg)}`,
    `สูญเสียน้ำเฉลี่ย ${pct(d.lossPct)} (สูญเสียรวม ${kg(d.lossKg)})`,
    `เฉลี่ยรายเที่ยว ${pct(d.avgLossPct)} · เฉลี่ย ${kg(d.avgLossKgPerTrip)}/เที่ยว · ใช้เวลาเฉลี่ย ${formatDuration(d.avgDurationMin)}`,
    ...d.windows.filter((w) => w.trips).map((w) => `ช่วง ${w.label}: ${w.trips} เที่ยว สูญเสีย ${pct(w.lossPct)}`),
  ].filter(Boolean)
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    toast.success('คัดลอกสรุปแล้ว')
  } catch {
    toast.error('คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาต')
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" title="สรุปผลการขนส่ง" :subtitle="scope" width="680px" @update:model-value="emit('update:modelValue', $event)">
    <div class="seg" role="tablist" aria-label="เลือกวิธีสรุป">
      <button type="button" role="tab" :aria-selected="tab === 'selected'" :class="{ on: tab === 'selected' }" @click="tab = 'selected'">ที่เลือกในตาราง ({{ ids.length }})</button>
      <button type="button" role="tab" :aria-selected="tab === 'range'" :class="{ on: tab === 'range' }" @click="tab = 'range'">ช่วงวัน-เวลา</button>
    </div>

    <div v-if="tab === 'range'" class="range">
      <div class="range__inputs">
        <label>ตั้งแต่ <input v-model="range.from" type="datetime-local" :max="range.to || undefined" /></label>
        <label>ถึง <input v-model="range.to" type="datetime-local" :min="range.from || undefined" /></label>
      </div>
      <div class="chips"><button v-for="p in PRESETS" :key="p.label" type="button" @click="applyPreset(p)">{{ p.label }}</button></div>
      <p class="note">นับจากวัน-เวลาที่ออกเดินทางของแต่ละเที่ยว</p>
      <p v-if="rangeError" class="err" role="alert">{{ rangeError }}</p>
    </div>

    <div class="out" :class="{ busy: loading }" aria-live="polite">
      <p v-if="noneSelected" class="state">ยังไม่ได้เลือกเที่ยวในตาราง<br /><small>ติ๊กช่องหน้าแถวที่ต้องการ หรือสลับไปแท็บ "ช่วงวัน-เวลา"</small></p>
      <p v-else-if="error" class="state state--err" role="alert">{{ error }} <button type="button" class="link" @click="load">ลองใหม่</button></p>
      <p v-else-if="loading && !data" class="state">กำลังคำนวณ…</p>
      <p v-else-if="empty" class="state">ไม่มีเที่ยวขนส่งในช่วงที่เลือก</p>

      <template v-else-if="data">
        <section class="hero">
          <small>ค่าเฉลี่ยการสูญเสียน้ำ</small>
          <b>{{ pct(data.lossPct) }}</b>
          <span>สูญเสียรวม {{ kg(data.lossKg) }} จากน้ำหนักที่ส่งรวม {{ kg(data.shippedKg) }}</span>
          <em>คิดแบบถ่วงน้ำหนัก = สูญเสียรวม ÷ น้ำหนักที่ส่งรวม — เที่ยวที่ส่งมากมีผลมากกว่า</em>
        </section>

        <div class="tiles">
          <div v-for="t in tiles" :key="t.k" class="tile"><small>{{ t.k }}</small><b>{{ t.v }}</b><em v-if="t.s">{{ t.s }}</em></div>
        </div>

        <section class="block">
          <h3>แยกตามช่วงเวลาออกเดินทาง</h3>
          <div v-for="w in data.windows" :key="w.key" class="win">
            <span class="win__name">{{ w.label }}<small>{{ w.trips }} เที่ยว</small></span>
            <span class="win__bar"><i :class="w.key" :style="{ width: barW(w) }" /></span>
            <span class="win__val">{{ pct(w.lossPct) }}<small>{{ w.trips ? kg(w.lossKg) : 'ไม่มีเที่ยว' }}</small></span>
          </div>
        </section>

        <section v-if="data.trips > 1" class="ext">
          <div><small>สูญเสียมากที่สุด</small><b>{{ tripLabel(data.maxTrip) }}</b></div>
          <div><small>สูญเสียน้อยที่สุด</small><b>{{ tripLabel(data.minTrip) }}</b></div>
        </section>
      </template>
    </div>

    <template #footer>
      <BaseButton variant="soft" :disabled="!data || !data.trips" @click="copy">คัดลอกสรุป</BaseButton>
      <BaseButton @click="emit('update:modelValue', false)">ปิด</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 9999px; background: var(--slate-100); margin-bottom: 14px; }
.seg button { padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; color: var(--slate-500); }
.seg button.on { background: #fff; color: var(--blue-700); box-shadow: 0 1px 3px rgba(15, 23, 42, .12); }
.range { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--slate-50); border: 1px solid var(--slate-100); }
.range__inputs { display: flex; gap: 12px; flex-wrap: wrap; }
.range label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-600); }
.range input { height: 36px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font: inherit; font-size: 13px; color: var(--slate-800); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #fff; border: 1px solid var(--blue-100); color: var(--blue-700); }
.chips button:hover { background: var(--blue-50); }
.note { font-size: 11px; color: var(--slate-500); }
.err { font-size: 12px; font-weight: 600; color: var(--red-700); }

.out { display: flex; flex-direction: column; gap: 14px; transition: opacity .15s; min-height: 120px; }
.out.busy { opacity: .55; }
.state { text-align: center; font-size: 13px; line-height: 1.8; color: var(--slate-500); padding: 36px 0; }
.state small { font-size: 12px; color: var(--slate-400); }
.state--err { color: var(--red-700); }
.link { color: var(--blue-700); font-weight: 600; text-decoration: underline; }

.hero { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 16px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); text-align: center; }
.hero small { font-size: 12px; font-weight: 700; color: var(--slate-600); }
.hero b { font-size: 44px; font-weight: 800; letter-spacing: -1px; line-height: 1.15; color: var(--blue-700); }
.hero span { font-size: 13px; color: var(--slate-700); }
.hero em { margin-top: 6px; font-style: normal; font-size: 11px; color: var(--slate-500); }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.tile { display: flex; flex-direction: column; gap: 1px; padding: 10px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); }
.tile small { font-size: 11px; color: var(--slate-500); }
.tile b { font-size: 16px; font-weight: 800; color: var(--slate-900); }
.tile em { font-style: normal; font-size: 10px; color: var(--slate-400); }

.block h3 { font-size: 13px; font-weight: 800; color: var(--slate-800); margin-bottom: 8px; }
.win { display: grid; grid-template-columns: 150px 1fr 110px; align-items: center; gap: 12px; padding: 6px 0; }
.win small { display: block; font-size: 11px; font-weight: 400; color: var(--slate-500); }
.win__name { font-size: 13px; font-weight: 600; color: var(--slate-800); }
.win__val { text-align: right; font-size: 14px; font-weight: 800; color: var(--slate-900); }
.win__bar { height: 10px; border-radius: 9999px; background: var(--slate-100); overflow: hidden; }
.win__bar i { display: block; height: 100%; border-radius: 9999px; background: var(--slate-400); }
.win__bar i.MORNING { background: #d97706; }
.win__bar i.AFTERNOON { background: #2563eb; }

.ext { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ext div { display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-radius: var(--radius-md); background: var(--slate-50); }
.ext small { font-size: 11px; color: var(--slate-500); }
.ext b { font-size: 12px; font-weight: 700; color: var(--slate-800); }
@media (max-width: 560px) { .win { grid-template-columns: 1fr 90px; } .win__bar { grid-column: 1 / -1; order: 3; } .ext { grid-template-columns: 1fr; } .hero b { font-size: 36px; } }
</style>

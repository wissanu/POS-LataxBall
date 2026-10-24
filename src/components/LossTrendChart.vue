<script setup>
// กราฟเส้นแนวโน้ม "น้ำหนักที่สูญเสียระหว่างขนส่ง" แยกสองช่วงเวลา (เช้า 06:00-12:00 / บ่าย 13:00-18:00) — SVG ล้วน
//  - เส้นทึบ = ค่าจริงของแต่ละวัน/สัปดาห์/เดือน (ช่วงที่ไม่มีเที่ยวจะข้ามไป ไม่ถูกวาดเป็น 0)
//  - เส้นประ = เส้นแนวโน้ม (ถดถอยเชิงเส้น) ชี้ว่าสูญเสียมากขึ้นหรือน้อยลงตลอดช่วงที่เลือก
//  - แกน Y เริ่มที่ 0 เพื่อให้ความสูงเทียบ "มาก-น้อย" ได้ตรงตา
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { compactNumber, formatNumber, fromISODate } from '@/utils/format'
import { linearTrend, metricValue } from '@/utils/transport'

const props = defineProps({
  series: { type: Array, required: true }, // [{ key, from, MORNING: { trips, shippedKg, lossKg }, AFTERNOON: {...} }]
  windows: { type: Array, required: true }, // [{ key, label }]
  metric: { type: String, default: 'lossKg' }, // lossKg | avgKg | lossPct
  groupBy: { type: String, default: 'day' },
})

const COLORS = { MORNING: '#d97706', AFTERNOON: '#2563eb' }
const NAMES = { MORNING: 'ช่วงเช้า', AFTERNOON: 'ช่วงบ่าย' }
const unit = computed(() => (props.metric === 'lossPct' ? '%' : 'กก.'))
const fmt = (v) => (v == null ? '–' : props.metric === 'lossPct' ? `${formatNumber(v)}%` : `${formatNumber(v)} กก.`)

const root = ref(null)
const width = ref(640)
const active = ref(-1)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => { width.value = Math.max(280, Math.floor(e.contentRect.width)) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const height = computed(() => (width.value < 480 ? 250 : 320))
const m = { top: 14, right: 16, bottom: 30, left: 50 }
const innerW = computed(() => width.value - m.left - m.right)
const innerH = computed(() => height.value - m.top - m.bottom)

// ค่าของแต่ละช่วงเวลา: { MORNING: [v|null,...], AFTERNOON: [...] }
const values = computed(() => Object.fromEntries(props.windows.map((w) => [w.key, props.series.map((p) => metricValue(p[w.key], props.metric))])))
const trends = computed(() => Object.fromEntries(props.windows.map((w) => [w.key, linearTrend(values.value[w.key])])))

const maxV = computed(() => Math.max(0, ...Object.values(values.value).flat().filter((v) => v != null), ...Object.values(trends.value).flatMap((t) => (t ? [t.start, t.end] : []))))
const yMax = computed(() => {
  const v = maxV.value || 1
  const pow = 10 ** Math.floor(Math.log10(v))
  return Math.ceil((v * 1.1) / (pow / 2)) * (pow / 2) // ปัดขึ้นเป็นเลขกลม พร้อมเว้นหัวกราฟเล็กน้อย
})
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => (yMax.value * i) / 4))
const n = computed(() => props.series.length)
const step = computed(() => innerW.value / Math.max(n.value - 1, 1))
const xOf = (i) => (n.value === 1 ? m.left + innerW.value / 2 : m.left + step.value * i)
const yOf = (v) => m.top + innerH.value * (1 - v / (yMax.value || 1))
const labelEvery = computed(() => Math.max(1, Math.ceil(64 / Math.max(step.value, 1))))

const line = (key) => values.value[key].flatMap((v, i) => (v == null ? [] : [[xOf(i), yOf(v)]])).map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
const dots = (key) => values.value[key].flatMap((v, i) => (v == null ? [] : [{ x: xOf(i), y: yOf(v), i }]))
const trendLine = (key) => {
  const t = trends.value[key]
  return t ? { x1: xOf(t.x0), y1: yOf(Math.max(0, t.start)), x2: xOf(t.x1), y2: yOf(Math.max(0, t.end)) } : null
}

const fmtDM = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const fmtMonth = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' })
const fmtFull = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const tick = (p) => (props.groupBy === 'month' ? fmtMonth.format(fromISODate(p.key)) : fmtDM.format(fromISODate(p.from)))
const full = (p) =>
  props.groupBy === 'month' ? fmtMonth.format(fromISODate(p.key))
  : props.groupBy === 'week' ? `สัปดาห์ที่เริ่ม ${fmtDM.format(fromISODate(p.from))}`
  : fmtFull.format(fromISODate(p.key))

const point = computed(() => props.series[active.value] ?? null)
const tip = computed(() => {
  if (!point.value) return null
  const top = Math.min(...props.windows.map((w) => values.value[w.key][active.value]).filter((v) => v != null), Infinity)
  return { left: `${Math.min(Math.max(xOf(active.value), 110), width.value - 110)}px`, top: `${top === Infinity ? m.top + 24 : Math.max(yOf(top) - 10, 8)}px` }
})
const detail = (p, key) => {
  const w = p[key]
  return w.trips ? `${w.trips} เที่ยว · เฉลี่ย ${formatNumber(w.lossKg / w.trips)} กก./เที่ยว · ${w.shippedKg > 0 ? formatNumber((w.lossKg / w.shippedKg) * 100) : '0.00'}%` : 'ไม่มีเที่ยวขนส่ง'
}

function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const i = Math.round((e.clientX - rect.left - m.left) / (step.value || 1))
  active.value = i >= 0 && i < n.value ? i : -1
}
function onKey(e) {
  const c = n.value
  if (!c) return
  const next = { ArrowRight: () => Math.min(c - 1, active.value + 1), ArrowLeft: () => Math.max(0, active.value < 0 ? c - 1 : active.value - 1), Home: () => 0, End: () => c - 1 }
  if (next[e.key]) { e.preventDefault(); active.value = next[e.key]() }
  if (e.key === 'Escape') active.value = -1
}
const aria = computed(() => {
  const parts = props.windows.map((w) => {
    const t = trends.value[w.key]
    const d = t ? { up: 'มีแนวโน้มเพิ่มขึ้น', down: 'มีแนวโน้มลดลง', flat: 'ทรงตัว' }[t.direction] : 'ยังมีข้อมูลไม่พอบอกแนวโน้ม'
    return `${NAMES[w.key]} ${w.label} ${d}`
  })
  return `กราฟแนวโน้มน้ำหนักที่สูญเสีย ${parts.join(' · ')} ใช้ลูกศรซ้ายขวาเพื่อดูแต่ละช่วง`
})
</script>

<template>
  <div ref="root" class="chart" @pointerleave="active = -1">
    <svg :width="width" :height="height" tabindex="0" role="img" :aria-label="aria" @pointermove="onMove" @keydown="onKey" @blur="active = -1">
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="m.left" :x2="width - m.right" :y1="yOf(t)" :y2="yOf(t)" />
          <text :x="m.left - 8" :y="yOf(t) + 4" text-anchor="end">{{ metric === 'lossPct' ? +t.toFixed(1) : compactNumber(t) }}</text>
        </template>
        <text class="unit" :x="m.left - 8" :y="m.top - 3" text-anchor="end">{{ unit }}</text>
      </g>

      <g v-for="w in windows" :key="w.key">
        <line v-if="trendLine(w.key)" v-bind="trendLine(w.key)" class="trend" :style="{ stroke: COLORS[w.key] }" />
        <path :d="line(w.key)" class="line" :style="{ stroke: COLORS[w.key] }" />
        <circle v-for="d in dots(w.key)" :key="d.i" :cx="d.x" :cy="d.y" :r="d.i === active ? 5 : n > 45 ? 1.5 : 3" class="dot" :style="{ stroke: COLORS[w.key] }" />
      </g>

      <line v-if="point" :x1="xOf(active)" :x2="xOf(active)" :y1="m.top" :y2="m.top + innerH" class="cursor" />
      <g class="xl">
        <text v-for="(p, i) in series" v-show="i % labelEvery === 0" :key="p.key" :x="xOf(i)" :y="height - 9" text-anchor="middle">{{ tick(p) }}</text>
      </g>
    </svg>

    <div v-if="point" class="tip" :style="tip">
      <b>{{ full(point) }}</b>
      <div v-for="w in windows" :key="w.key" class="tip__row">
        <span><i :style="{ background: COLORS[w.key] }" /> {{ NAMES[w.key] }} <small>{{ w.label }}</small></span>
        <em>{{ fmt(values[w.key][active]) }}</em>
        <small class="tip__sub">{{ detail(point, w.key) }}</small>
      </div>
    </div>
    <p class="sr-only" aria-live="polite">{{ point ? `${full(point)} ${windows.map((w) => `${NAMES[w.key]} ${fmt(values[w.key][active])}`).join(' ')}` : '' }}</p>
  </div>
</template>

<style scoped>
.chart { position: relative; width: 100%; }
svg { display: block; touch-action: pan-y; border-radius: var(--radius-md); }
svg:focus-visible { outline: 2px solid var(--blue-600); outline-offset: 2px; }
.grid line { stroke: var(--slate-200); stroke-width: 1; }
.grid text, .xl text { font-size: 11px; fill: var(--slate-500); }
.grid .unit { font-size: 10px; font-weight: 600; }
.line { fill: none; stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; }
.trend { stroke-width: 2; stroke-dasharray: 7 5; opacity: .75; }
.dot { fill: #fff; stroke-width: 2; }
.cursor { stroke: var(--slate-400); stroke-width: 1; stroke-dasharray: 3 3; }
.tip { position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 2; min-width: 210px; display: flex; flex-direction: column; gap: 6px; padding: 9px 12px; border-radius: 10px; background: var(--slate-900); color: #fff; font-size: 12px; box-shadow: var(--shadow-panel); }
.tip b { font-weight: 700; }
.tip__row { display: grid; grid-template-columns: 1fr auto; gap: 1px 10px; }
.tip__row span { display: flex; align-items: center; gap: 6px; color: #cbd5e1; }
.tip__row i { width: 8px; height: 8px; border-radius: 50%; }
.tip__row small { color: #94a3b8; font-size: 10px; }
.tip__row em { font-style: normal; font-weight: 700; color: #fff; }
.tip__sub { grid-column: 1 / -1; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>

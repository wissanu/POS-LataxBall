<script setup>
// Interactive line chart for daily buy prices (plain SVG).
//  - all grades: three lines per day = average / lowest / highest across the grades (shaded band between low and high)
//  - one grade : that grade's price per day, with dashed reference lines for the period's average / lowest / highest
// Days without a price board are gaps (the line breaks) — never drawn as 0.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { compactNumber, formatMoney, fromISODate } from '@/utils/format'

const props = defineProps({
  series: { type: Array, required: true }, // [{ date, avg, min, max, prices }]
  grade: { type: String, default: 'all' },
  stats: { type: Object, default: null }, // { avg, min, max }
})

const root = ref(null)
const width = ref(640)
const active = ref(-1)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => { width.value = Math.max(280, Math.floor(e.contentRect.width)) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const COLORS = { avg: '#2563eb', min: '#d97706', max: '#16a34a' }
const single = computed(() => props.grade !== 'all')
const height = computed(() => (width.value < 480 ? 240 : 300))
const m = { top: 14, right: 14, bottom: 30, left: 46 }
const innerW = computed(() => width.value - m.left - m.right)
const innerH = computed(() => height.value - m.top - m.bottom)

// the three plotted values per day (single grade: avg = min = max = that grade's price)
const pts = computed(() => props.series.map((s) => ({ ...s, v: single.value ? s.avg : null })))
const allVals = computed(() => props.series.flatMap((s) => (s.avg == null ? [] : [s.min, s.max, s.avg])))
const lo = computed(() => (allVals.value.length ? Math.min(...allVals.value) : 0))
const hi = computed(() => (allVals.value.length ? Math.max(...allVals.value) : 1))
const yMin = computed(() => Math.floor(Math.max(0, lo.value - (hi.value - lo.value || 1) * 0.15))) // a little head-room; prices are not drawn from 0
const yMax = computed(() => Math.ceil(hi.value + (hi.value - lo.value || 1) * 0.15))
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => yMin.value + ((yMax.value - yMin.value) * i) / 4))
const n = computed(() => props.series.length)
const step = computed(() => innerW.value / Math.max(n.value - 1, 1))
const xOf = (i) => (n.value === 1 ? m.left + innerW.value / 2 : m.left + step.value * i)
const yOf = (v) => m.top + innerH.value * (1 - (v - yMin.value) / (yMax.value - yMin.value || 1))
const labelEvery = computed(() => Math.max(1, Math.ceil(64 / Math.max(step.value, 1))))

// split into continuous runs so a missing day breaks the line
function runs(key) {
  const out = []
  let cur = []
  props.series.forEach((s, i) => {
    if (s[key] == null) { if (cur.length) out.push(cur); cur = []; return }
    cur.push([xOf(i), yOf(s[key]), i])
  })
  if (cur.length) out.push(cur)
  return out
}
const path = (run) => run.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
const band = computed(() =>
  runs('min').map((run) => {
    const top = props.series.map((s, i) => [xOf(i), s.max == null ? null : yOf(s.max)])
    const idx = run.map((r) => r[2])
    const upper = idx.map((i) => `${xOf(i).toFixed(1)},${top[i][1].toFixed(1)}`)
    const lower = [...run].reverse().map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    return `M${upper.join(' L')} L${lower.join(' L')} Z`
  }),
)
const dots = (key) => props.series.flatMap((s, i) => (s[key] == null ? [] : [{ x: xOf(i), y: yOf(s[key]), i }]))

const fmtDM = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const fmtFull = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const tick = (s) => fmtDM.format(fromISODate(s.date))
const full = (s) => fmtFull.format(fromISODate(s.date))

const point = computed(() => props.series[active.value] ?? null)
const tip = computed(() => {
  if (!point.value) return null
  const x = Math.min(Math.max(xOf(active.value), 100), width.value - 100)
  const y = point.value.avg == null ? m.top + 20 : Math.max(yOf(point.value.max) - 10, 8)
  return { left: `${x}px`, top: `${y}px` }
})

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
const summary = computed(() => (props.stats
  ? `กราฟเส้นราคารับซื้อ ${n.value} วัน เฉลี่ย ${props.stats.avg} ต่ำสุด ${props.stats.min} สูงสุด ${props.stats.max} บาทต่อกิโลกรัม ใช้ลูกศรซ้ายขวาเพื่อดูแต่ละวัน`
  : 'ไม่มีข้อมูลราคาในช่วงนี้'))
</script>

<template>
  <div ref="root" class="chart" @pointerleave="active = -1">
    <svg :width="width" :height="height" tabindex="0" role="img" :aria-label="summary" @pointermove="onMove" @keydown="onKey" @blur="active = -1">
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="m.left" :x2="width - m.right" :y1="yOf(t)" :y2="yOf(t)" />
          <text :x="m.left - 8" :y="yOf(t) + 4" text-anchor="end">{{ compactNumber(t) }}</text>
        </template>
      </g>

      <!-- all grades: band between the daily lowest and highest -->
      <g v-if="!single">
        <path v-for="(b, k) in band" :key="`b${k}`" :d="b" class="band" />
        <path v-for="(r, k) in runs('max')" :key="`mx${k}`" :d="path(r)" class="line line--max" />
        <path v-for="(r, k) in runs('min')" :key="`mn${k}`" :d="path(r)" class="line line--min" />
      </g>

      <!-- single grade: dashed reference lines for the period -->
      <g v-else-if="stats">
        <line v-for="k in ['max', 'avg', 'min']" :key="k" :x1="m.left" :x2="width - m.right" :y1="yOf(stats[k])" :y2="yOf(stats[k])" class="ref" :style="{ stroke: COLORS[k] }" />
      </g>

      <path v-for="(r, k) in runs('avg')" :key="`av${k}`" :d="path(r)" class="line line--avg" />
      <circle v-for="d in dots('avg')" :key="`d${d.i}`" :cx="d.x" :cy="d.y" :r="d.i === active ? 5 : n > 45 ? 0 : 2.5" class="dot" />

      <line v-if="point" :x1="xOf(active)" :x2="xOf(active)" :y1="m.top" :y2="m.top + innerH" class="cursor" />

      <g class="xl">
        <text v-for="(s, i) in series" v-show="i % labelEvery === 0" :key="s.date" :x="xOf(i)" :y="height - 9" text-anchor="middle">{{ tick(s) }}</text>
      </g>
    </svg>

    <div v-if="point" class="tip" :style="tip">
      <b>{{ full(point) }}</b>
      <template v-if="point.avg == null"><span class="tip__none">ไม่ได้ตั้งราคาวันนั้น</span></template>
      <template v-else-if="single"><span class="tip__main">{{ formatMoney(point.avg) }} / กก.</span></template>
      <template v-else>
        <span class="tip__row"><i :style="{ background: COLORS.max }" /> สูงสุด <em>{{ formatMoney(point.max) }}</em></span>
        <span class="tip__row"><i :style="{ background: COLORS.avg }" /> เฉลี่ย <em>{{ formatMoney(point.avg) }}</em></span>
        <span class="tip__row"><i :style="{ background: COLORS.min }" /> ต่ำสุด <em>{{ formatMoney(point.min) }}</em></span>
        <span class="tip__grades">{{ Object.entries(point.prices).map(([g, p]) => `${g} ${p}`).join(' · ') }}</span>
      </template>
    </div>
    <p class="sr-only" aria-live="polite">{{ point ? (point.avg == null ? `${full(point)} ไม่มีราคา` : `${full(point)} เฉลี่ย ${point.avg} ต่ำสุด ${point.min} สูงสุด ${point.max}`) : '' }}</p>
  </div>
</template>

<style scoped>
.chart { position: relative; width: 100%; }
svg { display: block; touch-action: pan-y; border-radius: var(--radius-md); }
svg:focus-visible { outline: 2px solid var(--blue-600); outline-offset: 2px; }
.grid line { stroke: var(--slate-200); stroke-width: 1; }
.grid text, .xl text { font-size: 11px; fill: var(--slate-500); }
.band { fill: #2563eb; opacity: .08; }
.line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
.line--avg { stroke: #2563eb; stroke-width: 2.5; }
.line--max { stroke: #16a34a; stroke-width: 1.5; opacity: .85; }
.line--min { stroke: #d97706; stroke-width: 1.5; opacity: .85; }
.ref { stroke-width: 1.2; stroke-dasharray: 5 4; opacity: .8; }
.dot { fill: #fff; stroke: #2563eb; stroke-width: 2; }
.cursor { stroke: var(--slate-400); stroke-width: 1; stroke-dasharray: 3 3; }
.tip {
  position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 2; min-width: 170px;
  display: flex; flex-direction: column; gap: 3px; padding: 8px 12px; border-radius: 10px;
  background: var(--slate-900); color: #fff; font-size: 12px; box-shadow: var(--shadow-panel);
}
.tip b { font-weight: 700; margin-bottom: 2px; }
.tip__main { font-size: 14px; font-weight: 700; }
.tip__none { color: #cbd5e1; }
.tip__row { display: flex; align-items: center; gap: 6px; color: #cbd5e1; }
.tip__row i { width: 8px; height: 8px; border-radius: 50%; }
.tip__row em { margin-left: auto; font-style: normal; font-weight: 700; color: #fff; }
.tip__grades { margin-top: 3px; padding-top: 5px; border-top: 1px solid #334155; color: #94a3b8; font-size: 11px; }
</style>

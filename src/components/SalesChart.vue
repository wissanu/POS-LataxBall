<script setup>
// Interactive column chart (plain SVG — no chart library). Hover or use ←/→ to inspect a bar.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { compactNumber, formatKg, formatMoney, fromISODate } from '@/utils/format'

const props = defineProps({
  points: { type: Array, required: true },            // [{ key: 'YYYY-MM-DD', total, netKg, bills }]
  metric: { type: String, default: 'total' },         // 'total' | 'netKg'
  groupBy: { type: String, default: 'day' },          // 'day' | 'week' | 'month'
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

const height = computed(() => (width.value < 480 ? 240 : 300))
const m = { top: 16, right: 12, bottom: 30, left: 46 }
const innerW = computed(() => width.value - m.left - m.right)
const innerH = computed(() => height.value - m.top - m.bottom)

const values = computed(() => props.points.map((p) => p[props.metric]))
const niceMax = computed(() => {
  const mx = Math.max(...values.value, 0)
  if (!mx) return 1
  const exp = 10 ** Math.floor(Math.log10(mx))
  const f = mx / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
})
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => (niceMax.value * i) / 4))
const step = computed(() => innerW.value / Math.max(props.points.length, 1))
const barW = computed(() => Math.max(1, Math.min(44, step.value * 0.7)))
const xBar = (i) => m.left + step.value * i + (step.value - barW.value) / 2
const xMid = (i) => m.left + step.value * (i + 0.5)
const yOf = (v) => m.top + innerH.value * (1 - v / niceMax.value)
const average = computed(() => (values.value.length ? values.value.reduce((a, b) => a + b, 0) / values.value.length : 0))
const labelEvery = computed(() => Math.max(1, Math.ceil(64 / step.value)))

const fmtDM = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const fmtMY = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' })
const fmtDay = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtMonth = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' })
const fmtFull = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

const tickLabel = (p) => (props.groupBy === 'month' ? fmtMY : fmtDM).format(fromISODate(p.key))
const fullLabel = (p) => {
  const d = fromISODate(p.key)
  if (props.groupBy === 'month') return fmtMonth.format(d)
  if (props.groupBy === 'week') return `สัปดาห์เริ่ม ${fmtFull.format(d)}`
  return fmtDay.format(d)
}
const fmtValue = (v) => (props.metric === 'total' ? formatMoney(v) : formatKg(v))

const point = computed(() => props.points[active.value] ?? null)
const tip = computed(() => {
  if (!point.value) return null
  const left = Math.min(Math.max(xMid(active.value), 90), width.value - 90)
  const top = Math.max(yOf(point.value[props.metric]) - 8, 8)
  return { left: `${left}px`, top: `${top}px` }
})

function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const i = Math.floor((e.clientX - rect.left - m.left) / step.value)
  active.value = i >= 0 && i < props.points.length ? i : -1
}
function onKey(e) {
  const n = props.points.length
  if (!n) return
  const keys = { ArrowRight: () => Math.min(n - 1, active.value + 1), ArrowLeft: () => Math.max(0, active.value < 0 ? n - 1 : active.value - 1), Home: () => 0, End: () => n - 1 }
  if (keys[e.key]) { e.preventDefault(); active.value = keys[e.key]() }
  if (e.key === 'Escape') active.value = -1
}
const summary = computed(() => `กราฟแท่ง ${props.points.length} ช่วง รวม ${fmtValue(values.value.reduce((a, b) => a + b, 0))} ใช้ลูกศรซ้ายขวาเพื่อดูแต่ละช่วง`)
</script>

<template>
  <div ref="root" class="chart" @pointerleave="active = -1">
    <svg
      :width="width" :height="height" tabindex="0" role="img" :aria-label="summary"
      @pointermove="onMove" @keydown="onKey" @blur="active = -1"
    >
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="m.left" :x2="width - m.right" :y1="yOf(t)" :y2="yOf(t)" />
          <text :x="m.left - 8" :y="yOf(t) + 4" text-anchor="end">{{ compactNumber(t) }}</text>
        </template>
      </g>

      <rect
        v-for="(p, i) in points" :key="p.key" class="bar" :class="{ on: i === active, dim: active >= 0 && i !== active }"
        :x="xBar(i)" :y="yOf(p[metric])" :width="barW" :height="Math.max(0, m.top + innerH - yOf(p[metric]))" :rx="barW > 8 ? 4 : 0"
      />

      <g v-if="average > 0" class="avg">
        <line :x1="m.left" :x2="width - m.right" :y1="yOf(average)" :y2="yOf(average)" />
        <text :x="width - m.right" :y="yOf(average) - 5" text-anchor="end">เฉลี่ย {{ compactNumber(average) }}</text>
      </g>

      <g class="xl">
        <text v-for="(p, i) in points" v-show="i % labelEvery === 0" :key="p.key" :x="xMid(i)" :y="height - 9" text-anchor="middle">{{ tickLabel(p) }}</text>
      </g>
    </svg>

    <div v-if="point" class="tip" :style="tip">
      <b>{{ fullLabel(point) }}</b>
      <span>{{ formatMoney(point.total) }}</span>
      <span>{{ formatKg(point.netKg) }} · {{ point.bills }} บิล</span>
    </div>
    <p class="sr-only" aria-live="polite">{{ point ? `${fullLabel(point)} ${fmtValue(point[metric])}` : '' }}</p>
  </div>
</template>

<style scoped>
.chart { position: relative; width: 100%; }
svg { display: block; touch-action: pan-y; border-radius: var(--radius-md); }
svg:focus-visible { outline: 2px solid var(--blue-600); outline-offset: 2px; }
.grid line { stroke: var(--slate-200); stroke-width: 1; }
.grid line:first-child { stroke: var(--slate-300); }
.grid text, .xl text { font-size: 11px; fill: var(--slate-500); }
.bar { fill: #93c5fd; transition: fill .12s, opacity .12s; }
.bar.on { fill: var(--blue-600); }
.bar.dim { opacity: .55; }
.avg line { stroke: var(--amber-600); stroke-width: 1.5; stroke-dasharray: 5 4; }
.avg text { font-size: 11px; font-weight: 600; fill: var(--amber-700); }
.tip {
  position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 2; min-width: 150px;
  display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 10px;
  background: var(--slate-900); color: #fff; font-size: 12px; box-shadow: var(--shadow-panel);
}
.tip b { font-size: 12px; font-weight: 700; }
.tip span { color: #cbd5e1; }
.tip span:first-of-type { color: #fff; font-weight: 700; font-size: 14px; }
@media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
</style>

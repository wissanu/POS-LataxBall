<script setup>
// กราฟรายรับ-รายจ่าย-กำไร (SVG ล้วน)
//  - แท่งเขียว = รายรับ (บิลโรงงาน) · แท่งส้ม = รายจ่ายรวม (ซื้อยาง + ค่าคนงาน + ค่าขนส่ง + อื่น ๆ)
//  - เส้น/จุดน้ำเงิน = กำไรสุทธิ (จุดแดง = ขาดทุน) · เส้นดำบาง ๆ = ศูนย์
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { compactNumber, formatMoney, fromISODate, round2 } from '@/utils/format'

const props = defineProps({
  points: { type: Array, required: true }, // [{ key, revenue, purchase, labor, transport, other }]
  groupBy: { type: String, default: 'day' },
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

const rows = computed(() => props.points.map((p) => {
  const expense = round2(p.purchase + p.labor + p.transport + p.other)
  return { ...p, expense, profit: round2(p.revenue - expense) }
}))

const height = computed(() => (width.value < 480 ? 250 : 320))
const m = { top: 16, right: 14, bottom: 30, left: 52 }
const innerW = computed(() => width.value - m.left - m.right)
const innerH = computed(() => height.value - m.top - m.bottom)

const niceCeil = (v) => {
  if (!(v > 0)) return 0
  const exp = 10 ** Math.floor(Math.log10(v)); const f = v / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
}
const yMax = computed(() => niceCeil(Math.max(0, ...rows.value.flatMap((r) => [r.revenue, r.expense, r.profit]))) || 1)
const yMin = computed(() => -niceCeil(-Math.min(0, ...rows.value.map((r) => r.profit))))
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => yMin.value + ((yMax.value - yMin.value) * i) / 4))
const yOf = (v) => m.top + innerH.value * (1 - (v - yMin.value) / (yMax.value - yMin.value))
const zero = computed(() => yOf(0))

const step = computed(() => innerW.value / Math.max(rows.value.length, 1))
const groupW = computed(() => Math.max(2, Math.min(56, step.value * 0.78)))
const barW = computed(() => groupW.value / 2)
const xMid = (i) => m.left + step.value * (i + 0.5)
const labelEvery = computed(() => Math.max(1, Math.ceil(64 / step.value)))
const bar = (v, x) => ({ x, y: Math.min(yOf(v), zero.value), width: Math.max(1, barW.value - 1), height: Math.abs(zero.value - yOf(v)) })
const line = computed(() => rows.value.map((r, i) => `${xMid(i)},${yOf(r.profit)}`).join(' '))
const dotR = computed(() => (step.value < 14 ? 2.5 : 4))

const fmtDM = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const fmtMY = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' })
const fmtFull = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMonth = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' })
const tickLabel = (p) => (props.groupBy === 'month' ? fmtMY : fmtDM).format(fromISODate(p.key))
const fullLabel = (p) => (props.groupBy === 'month' ? fmtMonth.format(fromISODate(p.key)) : props.groupBy === 'week' ? `สัปดาห์เริ่ม ${fmtFull.format(fromISODate(p.key))}` : fmtFull.format(fromISODate(p.key)))

const point = computed(() => rows.value[active.value] ?? null)
const tip = computed(() => {
  if (!point.value) return null
  return { left: `${Math.min(Math.max(xMid(active.value), 100), width.value - 100)}px`, top: `${Math.max(yOf(Math.max(point.value.revenue, point.value.expense, 0)) - 8, 8)}px` }
})
function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const i = Math.floor((e.clientX - rect.left - m.left) / step.value)
  active.value = i >= 0 && i < rows.value.length ? i : -1
}
function onKey(e) {
  const n = rows.value.length
  if (!n) return
  const keys = { ArrowRight: () => Math.min(n - 1, active.value + 1), ArrowLeft: () => Math.max(0, active.value < 0 ? n - 1 : active.value - 1), Home: () => 0, End: () => n - 1 }
  if (keys[e.key]) { e.preventDefault(); active.value = keys[e.key]() }
  if (e.key === 'Escape') active.value = -1
}
const summary = computed(() => `กราฟรายรับ รายจ่าย และกำไร ${rows.value.length} ช่วง ใช้ลูกศรซ้ายขวาเพื่อดูแต่ละช่วง`)
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
      <line class="zero" :x1="m.left" :x2="width - m.right" :y1="zero" :y2="zero" />

      <g v-for="(r, i) in rows" :key="r.key" :class="{ dim: active >= 0 && i !== active }">
        <rect class="b b--rev" v-bind="bar(r.revenue, xMid(i) - groupW / 2)" :rx="barW > 8 ? 3 : 0" />
        <rect class="b b--exp" v-bind="bar(r.expense, xMid(i))" :rx="barW > 8 ? 3 : 0" />
      </g>

      <polyline class="pl" :points="line" />
      <circle v-for="(r, i) in rows" :key="`d${r.key}`" :cx="xMid(i)" :cy="yOf(r.profit)" :r="i === active ? dotR + 1.5 : dotR" class="dot" :class="{ loss: r.profit < 0 }" />

      <g class="xl">
        <text v-for="(p, i) in rows" v-show="i % labelEvery === 0" :key="p.key" :x="xMid(i)" :y="height - 9" text-anchor="middle">{{ tickLabel(p) }}</text>
      </g>
    </svg>

    <div v-if="point" class="tip" :style="tip">
      <b>{{ fullLabel(point) }}</b>
      <span class="g">รายรับ {{ formatMoney(point.revenue) }}</span>
      <span class="o">รายจ่าย {{ formatMoney(point.expense) }}</span>
      <small>ซื้อยาง {{ formatMoney(point.purchase) }} · ค่าคนงาน {{ formatMoney(point.labor) }}</small>
      <small>ค่าขนส่ง {{ formatMoney(point.transport) }} · อื่น ๆ {{ formatMoney(point.other) }}</small>
      <strong :class="{ loss: point.profit < 0 }">กำไรสุทธิ {{ formatMoney(point.profit) }}</strong>
    </div>
    <p class="sr-only" aria-live="polite">{{ point ? `${fullLabel(point)} กำไรสุทธิ ${formatMoney(point.profit)}` : '' }}</p>
  </div>
</template>

<style scoped>
.chart { position: relative; width: 100%; }
svg { display: block; touch-action: pan-y; border-radius: var(--radius-md); }
svg:focus-visible { outline: 2px solid var(--blue-600); outline-offset: 2px; }
.grid line { stroke: var(--slate-200); stroke-width: 1; }
.grid text, .xl text { font-size: 11px; fill: var(--slate-500); }
.zero { stroke: var(--slate-500); stroke-width: 1; }
.b--rev { fill: #4ade80; } .b--exp { fill: #fbbf24; }
g.dim { opacity: .5; }
.pl { fill: none; stroke: var(--blue-600); stroke-width: 2; stroke-linejoin: round; }
.dot { fill: var(--blue-600); stroke: #fff; stroke-width: 1.5; }
.dot.loss { fill: #dc2626; }
.tip { position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 2; min-width: 190px; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 10px; background: var(--slate-900); color: #fff; font-size: 12px; box-shadow: var(--shadow-panel); }
.tip b { font-size: 12px; } .tip .g { color: #86efac; } .tip .o { color: #fcd34d; } .tip small { color: #94a3b8; font-size: 11px; }
.tip strong { margin-top: 3px; padding-top: 4px; border-top: 1px solid #334155; font-size: 14px; color: #93c5fd; } .tip strong.loss { color: #fca5a5; }
</style>

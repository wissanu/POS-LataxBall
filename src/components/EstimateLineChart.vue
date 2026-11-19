<script setup>
// กราฟเส้นของหน้า "ประเมินราคา" (SVG ล้วน) — วาดเส้นผลลัพธ์ตามตัวแปรหนึ่งตัว พร้อม
//   • พื้นที่เขียว/แดง เหนือ/ใต้เส้น 0 (กำไร/ขาดทุน) · เส้นแนวนอนอ้างอิง (เช่น เป้ากำไร) · เส้นตั้งแสดงจุดสำคัญ (ค่าปัจจุบัน / จุดเสมอตัว)
//   • เลื่อนเมาส์/แตะ = อ่านค่าตรงตำแหน่ง · คลิก/แตะ = emit pick(x) ให้หน้าเอาค่า x ไปใส่ช่องกรอกแล้วคำนวณใหม่
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  points: { type: Array, required: true }, // [{ x, y }]
  current: { type: Object, default: null }, // { x, y } จุดปัจจุบันตามช่องกรอก
  markers: { type: Array, default: () => [] }, // [{ x, label, color }] เส้นตั้ง
  refs: { type: Array, default: () => [] }, // [{ y, label, color }] เส้นนอน
  xFmt: { type: Function, default: (v) => String(v) },
  yFmt: { type: Function, default: (v) => String(v) },
  xLabel: { type: String, default: '' },
  yLabel: { type: String, default: '' },
  clickable: { type: Boolean, default: true },
})
const emit = defineEmits(['pick'])

const root = ref(null)
const width = ref(560)
const hover = ref(null)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => { width.value = Math.max(280, Math.floor(e.contentRect.width)) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const height = computed(() => (width.value < 480 ? 240 : 290))
const m = { top: 16, right: 14, bottom: 38, left: 62 }
const iw = computed(() => width.value - m.left - m.right)
const ih = computed(() => height.value - m.top - m.bottom)

const xs = computed(() => props.points.map((p) => p.x))
const x0 = computed(() => Math.min(...xs.value))
const x1 = computed(() => Math.max(...xs.value))
const ys = computed(() => [...props.points.map((p) => p.y), ...props.refs.map((r) => r.y), 0, ...(props.current ? [props.current.y] : [])])
const yMin = computed(() => { const v = Math.min(...ys.value); return v < 0 ? v - Math.abs(v) * 0.08 : 0 })
const yMax = computed(() => { const v = Math.max(...ys.value); return v > 0 ? v + Math.abs(v) * 0.08 : 0 })
const span = computed(() => yMax.value - yMin.value || 1)
const X = (v) => m.left + ((v - x0.value) / (x1.value - x0.value || 1)) * iw.value
const Y = (v) => m.top + ih.value * (1 - (v - yMin.value) / span.value)
const y0 = computed(() => Y(0))

const path = computed(() => props.points.map((p, k) => `${k ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' '))
// พื้นที่ระหว่างเส้นกับแกน 0 — ตัดด้วย clipPath: เหนือ 0 = เขียว, ใต้ 0 = แดง
const area = computed(() => `${path.value} L${X(props.points.at(-1).x).toFixed(1)},${y0.value.toFixed(1)} L${X(props.points[0].x).toFixed(1)},${y0.value.toFixed(1)} Z`)
const uid = `el${Math.random().toString(36).slice(2, 8)}`

const niceTicks = (a, b, n = 4) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n)
const yTicks = computed(() => niceTicks(yMin.value, yMax.value))
const xTicks = computed(() => niceTicks(x0.value, x1.value, width.value < 480 ? 3 : 5))

function locate(ev) {
  const r = root.value.querySelector('svg').getBoundingClientRect()
  const px = ev.clientX - r.left
  const v = x0.value + ((px - m.left) / (iw.value || 1)) * (x1.value - x0.value)
  return Math.min(x1.value, Math.max(x0.value, v))
}
function nearest(v) {
  let best = props.points[0]
  for (const p of props.points) if (Math.abs(p.x - v) < Math.abs(best.x - v)) best = p
  return best
}
const onMove = (ev) => { hover.value = nearest(locate(ev)) }
const onClick = (ev) => { if (props.clickable) emit('pick', locate(ev)) }
const tipLeft = computed(() => hover.value && X(hover.value.x) > width.value * 0.62)
</script>

<template>
  <div ref="root" class="elc">
    <svg :width="width" :height="height" role="img" :aria-label="`${yLabel} ตาม ${xLabel}`" @pointermove="onMove" @pointerleave="hover = null" @click="onClick" :class="{ pick: clickable }">
      <defs>
        <clipPath :id="`${uid}-up`"><rect :x="m.left" :y="m.top" :width="iw" :height="Math.max(0, y0 - m.top)" /></clipPath>
        <clipPath :id="`${uid}-dn`"><rect :x="m.left" :y="y0" :width="iw" :height="Math.max(0, m.top + ih - y0)" /></clipPath>
      </defs>
      <g class="grid">
        <g v-for="t in yTicks" :key="'y' + t">
          <line :x1="m.left" :x2="m.left + iw" :y1="Y(t)" :y2="Y(t)" />
          <text :x="m.left - 8" :y="Y(t) + 4" text-anchor="end">{{ yFmt(t) }}</text>
        </g>
        <g v-for="t in xTicks" :key="'x' + t"><text :x="X(t)" :y="m.top + ih + 16" text-anchor="middle">{{ xFmt(t) }}</text></g>
      </g>
      <path :d="area" :clip-path="`url(#${uid}-up)`" class="a-up" />
      <path :d="area" :clip-path="`url(#${uid}-dn)`" class="a-dn" />
      <line :x1="m.left" :x2="m.left + iw" :y1="y0" :y2="y0" class="zero" />
      <g v-for="(r, i) in refs" :key="'r' + i">
        <line :x1="m.left" :x2="m.left + iw" :y1="Y(r.y)" :y2="Y(r.y)" class="ref" :stroke="r.color || '#d97706'" />
        <text :x="m.left + iw - 4" :y="Y(r.y) - 5" text-anchor="end" :fill="r.color || '#d97706'" class="mk">{{ r.label }}</text>
      </g>
      <g v-for="(k, i) in markers" :key="'m' + i" v-show="k.x >= x0 && k.x <= x1">
        <line :x1="X(k.x)" :x2="X(k.x)" :y1="m.top" :y2="m.top + ih" class="vline" :stroke="k.color || '#64748b'" />
        <text :x="X(k.x) + (X(k.x) > width * 0.75 ? -4 : 4)" :y="m.top + 11 + (i % 3) * 12" :text-anchor="X(k.x) > width * 0.75 ? 'end' : 'start'" :fill="k.color || '#64748b'" class="mk">{{ k.label }}</text>
      </g>
      <path :d="path" class="line" />
      <g v-if="current">
        <circle :cx="X(current.x)" :cy="Y(current.y)" r="6" class="cur" />
      </g>
      <g v-if="hover" class="hov">
        <line :x1="X(hover.x)" :x2="X(hover.x)" :y1="m.top" :y2="m.top + ih" />
        <circle :cx="X(hover.x)" :cy="Y(hover.y)" r="4" />
        <g :transform="`translate(${X(hover.x) + (tipLeft ? -8 : 8)},${m.top + 6})`">
          <rect :x="tipLeft ? -128 : 0" y="0" width="128" height="40" rx="6" />
          <text :x="tipLeft ? -120 : 8" y="16">{{ xLabel }} {{ xFmt(hover.x) }}</text>
          <text :x="tipLeft ? -120 : 8" y="32" class="b" :class="hover.y < 0 ? 'neg' : 'pos'">{{ yLabel }} {{ yFmt(hover.y) }}</text>
        </g>
      </g>
      <text :x="m.left + iw / 2" :y="height - 4" text-anchor="middle" class="ax">{{ xLabel }}</text>
    </svg>
  </div>
</template>

<style scoped>
.elc { width: 100%; }
svg { display: block; touch-action: pan-y; }
svg.pick { cursor: crosshair; }
.grid line { stroke: var(--slate-200); stroke-width: 1; }
.grid text { font-size: 10.5px; fill: var(--slate-500); }
.ax { font-size: 11px; fill: var(--slate-500); font-weight: 600; }
.a-up { fill: rgba(5, 150, 105, 0.16); }
.a-dn { fill: rgba(220, 38, 38, 0.16); }
.zero { stroke: var(--slate-400); stroke-width: 1.2; }
.line { fill: none; stroke: #1d4ed8; stroke-width: 2.4; stroke-linejoin: round; }
.ref { stroke-width: 1.2; stroke-dasharray: 5 4; }
.vline { stroke-width: 1.2; stroke-dasharray: 3 3; }
.mk { font-size: 10.5px; font-weight: 700; }
.cur { fill: #fff; stroke: #1d4ed8; stroke-width: 3; }
.hov line { stroke: var(--slate-400); stroke-width: 1; }
.hov circle { fill: #1d4ed8; }
.hov rect { fill: #0f172a; opacity: 0.92; }
.hov text { font-size: 11px; fill: #e2e8f0; }
.hov text.b { font-weight: 800; }
.hov text.pos { fill: #6ee7b7; } .hov text.neg { fill: #fca5a5; }
</style>

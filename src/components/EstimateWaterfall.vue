<script setup>
// กราฟน้ำตก: เงินหายไปไหนบ้างระหว่าง "รายรับถ้าไม่สูญเสีย" กับ "กำไรสุทธิ" (บาท/วัน)
// steps = [{ key, label, value, type: 'total' | 'delta' }] — total = แท่งตั้งแต่ 0 · delta = แท่งลอยเพิ่ม/ลดจากยอดสะสม
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { compactNumber, formatNumber } from '@/utils/format'

const props = defineProps({ steps: { type: Array, required: true } })
const root = ref(null)
const width = ref(560)
let ro
onMounted(() => { ro = new ResizeObserver(([e]) => { width.value = Math.max(280, Math.floor(e.contentRect.width)) }); ro.observe(root.value) })
onBeforeUnmount(() => ro?.disconnect())

const height = computed(() => (width.value < 480 ? 250 : 290))
const m = { top: 20, right: 10, bottom: 46, left: 58 }
const iw = computed(() => width.value - m.left - m.right)
const ih = computed(() => height.value - m.top - m.bottom)

// แท่งแต่ละอัน: [lo, hi] ในแกนเงิน
const bars = computed(() => {
  let run = 0
  return props.steps.map((s) => {
    if (s.type === 'total') { run = s.value; return { ...s, lo: Math.min(0, s.value), hi: Math.max(0, s.value), end: s.value } }
    const from = run; run += s.value
    return { ...s, lo: Math.min(from, run), hi: Math.max(from, run), end: run }
  })
})
const vMax = computed(() => Math.max(1, ...bars.value.map((b) => b.hi)))
const vMin = computed(() => Math.min(0, ...bars.value.map((b) => b.lo)))
const Y = (v) => m.top + ih.value * (1 - (v - vMin.value) / (vMax.value - vMin.value || 1))
const slot = computed(() => iw.value / bars.value.length)
const bw = computed(() => Math.min(54, slot.value * 0.62))
const ticks = computed(() => [0, 1, 2, 3, 4].map((k) => vMin.value + ((vMax.value - vMin.value) * k) / 4))
const color = (b) => (b.type === 'total' ? (b.key === 'net' ? (b.value >= 0 ? '#059669' : '#dc2626') : '#3b82f6') : b.value < 0 ? '#f87171' : '#34d399')
const short = { full: 'ไม่สูญเสีย', lost: 'น้ำหนักหาย', cost: 'ต้นทุนซื้อ', gross: 'ขั้นต้น', fixed: 'ค่าใช้จ่าย', net: 'สุทธิ' }
const hover = ref(-1)
</script>

<template>
  <div ref="root" class="wf">
    <svg :width="width" :height="height" role="img" aria-label="น้ำตกกำไร">
      <g class="grid">
        <g v-for="t in ticks" :key="t"><line :x1="m.left" :x2="m.left + iw" :y1="Y(t)" :y2="Y(t)" /><text :x="m.left - 7" :y="Y(t) + 4" text-anchor="end">{{ compactNumber(t) }}</text></g>
      </g>
      <line :x1="m.left" :x2="m.left + iw" :y1="Y(0)" :y2="Y(0)" class="zero" />
      <g v-for="(b, i) in bars" :key="b.key" @pointerenter="hover = i" @pointerleave="hover = -1">
        <rect :x="m.left + slot * i + (slot - bw) / 2" :y="Y(b.hi)" :width="bw" :height="Math.max(2, Y(b.lo) - Y(b.hi))" :fill="color(b)" rx="3" :opacity="hover < 0 || hover === i ? 1 : 0.55" />
        <line v-if="i < bars.length - 1" :x1="m.left + slot * i + (slot + bw) / 2" :x2="m.left + slot * (i + 1) + (slot - bw) / 2" :y1="Y(b.end)" :y2="Y(b.end)" class="conn" />
        <text :x="m.left + slot * i + slot / 2" :y="Y(b.hi) - 5" text-anchor="middle" class="val">{{ b.value > 0 && b.type === 'delta' ? '+' : '' }}{{ compactNumber(b.value) }}</text>
        <text :x="m.left + slot * i + slot / 2" :y="m.top + ih + 16" text-anchor="middle" class="cat">{{ width < 480 ? short[b.key] : b.label }}</text>
      </g>
    </svg>
    <p v-if="hover >= 0" class="tip">{{ bars[hover].label }}: <b>{{ formatNumber(bars[hover].value) }} บาท</b></p>
  </div>
</template>

<style scoped>
.wf { width: 100%; }
svg { display: block; }
.grid line { stroke: var(--slate-200); } .grid text { font-size: 10.5px; fill: var(--slate-500); }
.zero { stroke: var(--slate-400); stroke-width: 1.2; }
.conn { stroke: var(--slate-400); stroke-dasharray: 3 3; }
.val { font-size: 11px; font-weight: 800; fill: var(--slate-800); }
.cat { font-size: 10.5px; font-weight: 600; fill: var(--slate-600); }
.tip { margin: 4px 0 0; font-size: 12px; color: var(--slate-600); }
</style>

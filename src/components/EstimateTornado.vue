<script setup>
// กราฟ "ปัจจัยไหนกระทบกำไรมากที่สุด" (tornado) — แท่งซ้าย = ผลเมื่อปัจจัยเปลี่ยนไปทางแย่ · แท่งขวา = ทางดี · เรียงจากกระทบมากไปน้อย
// rows = [{ key, label, step, down, up, downLabel, upLabel }] (down <= 0 <= up ส่วนใหญ่) — หน่วยบาท/วัน
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatNumber } from '@/utils/format'

const props = defineProps({ rows: { type: Array, required: true } })
const root = ref(null)
const width = ref(560)
const hover = ref(-1)
let ro
onMounted(() => { ro = new ResizeObserver(([e]) => { width.value = Math.max(280, Math.floor(e.contentRect.width)) }); ro.observe(root.value) })
onBeforeUnmount(() => ro?.disconnect())

const narrow = computed(() => width.value < 480)
const labelW = computed(() => (narrow.value ? 96 : 150))
const rowH = 38
const height = computed(() => props.rows.length * rowH + 30)
const iw = computed(() => width.value - labelW.value - 10)
const maxAbs = computed(() => Math.max(1, ...props.rows.flatMap((r) => [Math.abs(r.down), Math.abs(r.up)])))
const cx = computed(() => labelW.value + iw.value / 2)
const len = (v) => (Math.abs(v) / maxAbs.value) * (iw.value / 2 - 40)
const fmt = (v) => `${v > 0 ? '+' : ''}${formatNumber(Math.round(v))}`
</script>

<template>
  <div ref="root" class="tor">
    <svg :width="width" :height="height" role="img" aria-label="ปัจจัยที่กระทบกำไรสุทธิต่อวัน">
      <line :x1="cx" :x2="cx" y1="6" :y2="height - 18" class="mid" />
      <g v-for="(r, i) in rows" :key="r.key" :transform="`translate(0,${6 + i * rowH})`" @pointerenter="hover = i" @pointerleave="hover = -1">
        <rect x="0" y="0" :width="width" :height="rowH - 4" :class="['rowbg', { on: hover === i }]" rx="6" />
        <text :x="6" y="15" class="lb">{{ r.label }}</text>
        <text :x="6" y="29" class="st">{{ r.step }}</text>
        <rect :x="cx - len(r.down)" y="6" :width="len(r.down)" height="22" rx="3" class="bad" />
        <rect :x="cx" y="6" :width="len(r.up)" height="22" rx="3" class="good" />
        <text :x="cx - len(r.down) - 5" y="22" text-anchor="end" class="v bad-t">{{ fmt(r.down) }}</text>
        <text :x="cx + len(r.up) + 5" y="22" class="v good-t">{{ fmt(r.up) }}</text>
      </g>
      <text :x="cx" :y="height - 4" text-anchor="middle" class="ax">เปลี่ยนจากกำไรสุทธิปัจจุบัน (บาท/วัน) · ซ้าย = แย่ลง · ขวา = ดีขึ้น</text>
    </svg>
    <p v-if="hover >= 0" class="tip">{{ rows[hover].label }}: <b class="bad-t">{{ rows[hover].downLabel }} → {{ fmt(rows[hover].down) }}</b> · <b class="good-t">{{ rows[hover].upLabel }} → {{ fmt(rows[hover].up) }}</b> บาท/วัน</p>
  </div>
</template>

<style scoped>
.tor { width: 100%; }
svg { display: block; }
.mid { stroke: var(--slate-400); stroke-width: 1.2; }
.rowbg { fill: transparent; } .rowbg.on { fill: var(--slate-50, #f8fafc); }
.lb { font-size: 12px; font-weight: 700; fill: var(--slate-800); } .st { font-size: 10.5px; fill: var(--slate-500); }
.bad { fill: #f87171; } .good { fill: #34d399; }
.v { font-size: 11px; font-weight: 800; } .bad-t { fill: #b91c1c; color: #b91c1c; } .good-t { fill: #047857; color: #047857; }
.ax { font-size: 10.5px; fill: var(--slate-500); }
.tip { margin: 4px 0 0; font-size: 12px; color: var(--slate-600); }
</style>

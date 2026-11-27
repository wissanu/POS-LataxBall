<script setup>
// กราฟกำไร/กก. ตามน้ำหนักรับซื้อต่อวัน — เส้นเหนือศูนย์ = ไม่ขาดทุน · จุดที่เส้นตัดศูนย์ = น้ำหนักขั้นต่ำที่ต้องรับซื้อ
import { computed } from 'vue'
import { formatNumber } from '@/utils/format'

const props = defineProps({
  series: { type: Array, required: true }, // [{ label, color, dash, breakEven, points: [{x,y}] }]
  xMax: { type: Number, required: true },
  W: { type: Number, default: 0 }, // น้ำหนักที่คาดไว้ (เส้นประแนวตั้ง)
})
const VW = 640, VH = 300, L = 52, R = 14, T = 14, B = 42
const yr = computed(() => {
  const ys = props.series.flatMap((s) => s.points.map((p) => p.y))
  const lo = Math.min(0, ...ys), hi = Math.max(0, ...ys)
  const pad = (hi - lo || 1) * 0.08
  return [lo - (lo < 0 ? pad : 0), hi + pad]
})
const sx = (x) => L + (x / props.xMax) * (VW - L - R)
const sy = (y) => T + (1 - (y - yr.value[0]) / (yr.value[1] - yr.value[0])) * (VH - T - B)
const ticks = (lo, hi, n) => { const step = (hi - lo) / n; return Array.from({ length: n + 1 }, (_, i) => lo + step * i) }
const xt = computed(() => ticks(0, props.xMax, 5))
const yt = computed(() => { const [lo, hi] = yr.value; const raw = (hi - lo) / 5, p = Math.pow(10, Math.floor(Math.log10(raw))); const st = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Math.round(v * 1e6) / 1e6); return out })
const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
</script>

<template>
  <figure class="pvc">
    <svg :viewBox="`0 0 ${VW} ${VH}`" role="img" aria-label="กราฟกำไรต่อกิโลกรัมตามน้ำหนักรับซื้อต่อวัน">
      <g class="grid">
        <line v-for="v in yt" :key="'y' + v" :x1="L" :x2="VW - R" :y1="sy(v)" :y2="sy(v)" :class="{ zero: Math.abs(v) < 1e-9 }" />
        <text v-for="v in yt" :key="'yt' + v" :x="L - 6" :y="sy(v) + 4" text-anchor="end">{{ formatNumber(v) }}</text>
        <text v-for="v in xt" :key="'xt' + v" :x="sx(v)" :y="VH - B + 16" text-anchor="middle">{{ formatNumber(v) }}</text>
      </g>
      <line v-if="W > 0 && W <= xMax" :x1="sx(W)" :x2="sx(W)" :y1="T" :y2="VH - B" class="wline" />
      <text v-if="W > 0 && W <= xMax" :x="sx(W)" :y="T + 10" text-anchor="middle" class="wtxt">ที่คาดไว้ {{ formatNumber(W) }}</text>
      <path v-for="s in series" :key="s.label" :d="path(s.points)" :stroke="s.color" :stroke-dasharray="s.dash" fill="none" stroke-width="2.2" />
      <g v-for="s in series" :key="'be' + s.label">
        <template v-if="s.breakEven && s.breakEven <= xMax">
          <circle :cx="sx(s.breakEven)" :cy="sy(0)" r="4.5" :fill="s.color" stroke="#fff" stroke-width="1.5" />
        </template>
      </g>
      <text :x="(L + VW - R) / 2" :y="VH - 6" text-anchor="middle" class="ax">น้ำหนักรับซื้อต่อวัน (กก.)</text>
      <text :x="12" :y="(T + VH - B) / 2" text-anchor="middle" class="ax" :transform="`rotate(-90 12 ${(T + VH - B) / 2})`">กำไร/กก. (บาท)</text>
    </svg>
    <figcaption>
      <span v-for="s in series" :key="'lg' + s.label" class="lg"><i :style="{ background: s.color }" />{{ s.label }}<template v-if="s.breakEven"> · ไม่ขาดทุนเมื่อ ≥ {{ formatNumber(s.breakEven) }} กก./วัน</template><template v-else> · ไม่มีจุดเสมอตัว</template></span>
    </figcaption>
  </figure>
</template>

<style scoped>
.pvc { margin: 0; }
svg { width: 100%; height: auto; display: block; }
.grid line { stroke: var(--slate-100); stroke-width: 1; } .grid line.zero { stroke: var(--slate-500); stroke-width: 1.4; }
.grid text, .ax { fill: var(--slate-500); font-size: 11px; }
.wline { stroke: var(--slate-400, #94a3b8); stroke-dasharray: 4 4; } .wtxt { fill: var(--slate-500); font-size: 10.5px; }
figcaption { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--slate-600); margin-top: 4px; }
.lg { display: inline-flex; align-items: center; gap: 5px; } .lg i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
</style>

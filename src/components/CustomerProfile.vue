<script setup>
// ลักษณะยางที่ลูกค้ามักส่ง (จากที่จดตอนรับซื้อ) — ไว้สังเกตก่อนรับซื้อ + ติดตามว่าลูกค้าพัฒนาขึ้นไหม (ใช้ตัวเลขจากบิลจริงเท่านั้น)
import { computed } from 'vue'
import { formatNumber } from '@/utils/format'

const props = defineProps({ customer: { type: Object, required: true }, compact: { type: Boolean, default: false } })
const p = computed(() => props.customer.profile)
const has = computed(() => p.value && p.value.ratedOrders + (p.value.avgPorosity != null ? 1 : 0) + (p.value.avgKnives != null ? 1 : 0) > 0)
const n = (v) => formatNumber(v)

const chips = computed(() => {
  const x = p.value, out = []
  if (!x) return out
  if (x.softPct != null) out.push({ k: 'soft', text: x.softPct >= 50 ? `มักส่งยางนิ่ม/อมน้ำ ${n(x.softPct)}%` : x.dryPct >= 50 ? `ยางแห้ง ${n(x.dryPct)}%` : `ยางนิ่ม/อมน้ำ ${n(x.softPct)}%`, tone: x.softPct >= 50 ? 'bad' : x.dryPct >= 50 ? 'ok' : 'mid' })
  if (x.avgPorosity != null) out.push({ k: 'por', text: `พรุน${x.avgPorosity >= 3.5 ? 'สูง' : x.avgPorosity <= 2.5 ? 'ต่ำ' : 'ปานกลาง'} (เฉลี่ย ${n(x.avgPorosity)}/5)`, tone: x.avgPorosity >= 3.5 ? 'bad' : x.avgPorosity <= 2.5 ? 'ok' : 'mid' })
  if (x.avgKnives != null) out.push({ k: 'kn', text: `เฉลี่ย ${n(x.avgKnives)} มีด`, tone: 'mid' })
  return out
})
// แนวโน้ม: ใบล่าสุดเทียบใบก่อนหน้า (ต้องจดอย่างน้อย 4 ใบ) · ความแห้ง/ DRC ลดลง = ดีขึ้น เฉพาะที่รู้ทิศชัดเจน
const trends = computed(() => {
  const t = p.value?.trend, out = []
  if (!t) return out
  if (t.dryness && Math.abs(t.dryness.delta) >= 0.3) out.push(t.dryness.delta < 0 ? { text: `แห้งขึ้น (${n(t.dryness.earlier)} → ${n(t.dryness.recent)})`, tone: 'ok' } : { text: `เปียกขึ้น (${n(t.dryness.earlier)} → ${n(t.dryness.recent)})`, tone: 'bad' })
  if (t.porosity && Math.abs(t.porosity.delta) >= 0.3) out.push({ text: `พรุน${t.porosity.delta < 0 ? 'น้อยลง' : 'มากขึ้น'} (${n(t.porosity.earlier)} → ${n(t.porosity.recent)})`, tone: t.porosity.delta < 0 ? 'ok' : 'bad' })
  if (t.knives && Math.abs(t.knives.delta) >= 0.5) out.push({ text: `จำนวนมีด${t.knives.delta < 0 ? 'ลดลง' : 'เพิ่มขึ้น'} (${n(t.knives.earlier)} → ${n(t.knives.recent)})`, tone: 'mid' })
  return out
})
const verdict = computed(() => {
  const c = props.customer, t = p.value?.trend
  let score = 0, seen = false
  if (c.trendPct != null) { seen = true; score += c.trendPct >= 0.5 ? 1 : c.trendPct <= -0.5 ? -1 : 0 }
  if (t?.dryness) { seen = true; score += t.dryness.delta <= -0.3 ? 1 : t.dryness.delta >= 0.3 ? -1 : 0 }
  if (!seen) return null
  return score > 0 ? { text: 'พัฒนาขึ้น', tone: 'ok' } : score < 0 ? { text: 'แย่ลง', tone: 'bad' } : { text: 'ทรงตัว', tone: 'mid' }
})
</script>

<template>
  <div class="cp" :class="{ compact }">
    <template v-if="has">
      <span v-for="c in chips" :key="c.k" class="chip" :class="c.tone">{{ c.text }}</span>
      <span v-for="t in trends" :key="t.text" class="chip trend" :class="t.tone">{{ t.text }}</span>
      <span v-if="verdict" class="chip verdict" :class="verdict.tone">แนวโน้มรวม: {{ verdict.text }}</span>
      <span v-if="!compact" class="note">จากที่จดไว้ {{ p.ratedOrders }}/{{ p.orders }} ใบ — จดที่หน้ารับออเดอร์ใหม่ ทุกใบ ค่ายิ่งแม่น</span>
    </template>
    <span v-else class="note">ยังไม่มีข้อมูลลักษณะยาง — จดความแห้ง/ความพรุน/จำนวนมีดที่หน้ารับออเดอร์ใหม่</span>
  </div>
</template>

<style scoped>
.cp { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.chip { padding: 2px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: var(--slate-100); color: var(--slate-600); }
.chip.ok { background: var(--green-50); color: var(--green-700); } .chip.bad { background: var(--red-50); color: var(--red-700); } .chip.mid { background: var(--blue-50); color: var(--blue-700); }
.chip.trend { font-weight: 600; } .chip.verdict { box-shadow: inset 0 0 0 1px currentColor; }
.note { font-size: 11px; color: var(--slate-500); }
.compact .chip { font-size: 10.5px; padding: 1px 8px; }
</style>

<script setup>
// Permission checklist grouped by module. Shows which rows differ from `base` (the role defaults).
import { computed } from 'vue'

const MODULES = {
  customer: 'ลูกค้า', purchase: 'ใบรับซื้อ', weighing: 'ชั่งน้ำหนัก', inspection: 'ตรวจเกรดและ DRC', pricing: 'ราคาและเกรด',
  payment: 'การจ่ายเงิน', receipt: 'ใบรับซื้อ (ออกเอกสาร)', report: 'รายงาน', admin: 'ผู้ดูแลระบบ', ml: 'โมเดลทำนายเกรด', profile: 'โปรไฟล์ของตัวเอง',
}

const props = defineProps({
  catalog: { type: Array, required: true },            // [{ code, module, name }]
  granted: { type: Object, required: true },           // Set of permission codes currently on
  base: { type: Object, default: null },               // Set of role defaults (user mode) — marks differences
  readonly: Boolean,
})
const emit = defineEmits(['toggle', 'toggle-module'])

const groups = computed(() => {
  const map = new Map()
  for (const p of props.catalog) {
    if (!map.has(p.module)) map.set(p.module, [])
    map.get(p.module).push(p)
  }
  return [...map].map(([module, items]) => ({ module, label: MODULES[module] ?? module, items }))
})
const allOn = (g) => g.items.every((p) => props.granted.has(p.code))
const diff = (code) => (props.base ? props.granted.has(code) !== props.base.has(code) : false)
</script>

<template>
  <div class="matrix">
    <fieldset v-for="g in groups" :key="g.module" class="group" :disabled="readonly">
      <legend>
        <span>{{ g.label }}</span>
        <button v-if="!readonly" type="button" class="all" @click="emit('toggle-module', g.module, !allOn(g))">{{ allOn(g) ? 'ล้างทั้งกลุ่ม' : 'เลือกทั้งกลุ่ม' }}</button>
      </legend>
      <label v-for="p in g.items" :key="p.code" class="row" :class="{ changed: diff(p.code) }">
        <input type="checkbox" :checked="granted.has(p.code)" @change="emit('toggle', p.code)" />
        <span class="name">{{ p.name }} <code>{{ p.code }}</code></span>
        <span v-if="diff(p.code)" class="badge" :class="granted.has(p.code) ? 'badge--on' : 'badge--off'">{{ granted.has(p.code) ? 'เพิ่มให้' : 'ถอดออก' }}</span>
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 14px; }
.group { margin: 0; padding: 4px 6px 8px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: rgba(255, 255, 255, .75); min-width: 0; }
legend { display: flex; align-items: center; gap: 10px; padding: 0 8px; font-size: 13px; font-weight: 700; color: var(--slate-800); }
.all { font-size: 11px; font-weight: 600; color: var(--blue-600); }
.row { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
.row:hover { background: var(--slate-50); }
.row.changed { background: var(--amber-50); }
input { width: 16px; height: 16px; flex: none; accent-color: var(--blue-600); }
.name { flex: 1; min-width: 0; font-size: 13px; color: var(--slate-800); }
code { display: block; font-size: 11px; color: var(--slate-500); }
.badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; white-space: nowrap; }
.badge--on { background: var(--green-100); color: var(--green-700); }
.badge--off { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; }
fieldset:disabled .row { cursor: default; opacity: .85; }
</style>

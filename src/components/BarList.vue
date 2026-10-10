<script setup>
// Horizontal ranking bars. With `selectable`, each row is a button (click again to clear).
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },     // [{ key, name, value, sub? }]
  format: { type: Function, required: true }, // value -> text
  selectable: Boolean,
  activeKey: { type: String, default: null },
  empty: { type: String, default: 'ไม่มีข้อมูลในช่วงนี้' },
})
const emit = defineEmits(['select'])

const max = computed(() => Math.max(...props.items.map((i) => i.value), 1))
const sum = computed(() => props.items.reduce((s, i) => s + i.value, 0) || 1)
const share = (v) => `${((v / sum.value) * 100).toFixed(0)}%`
</script>

<template>
  <p v-if="!items.length" class="none">{{ empty }}</p>
  <ul v-else class="list">
    <li v-for="it in items" :key="it.key">
      <component
        :is="selectable ? 'button' : 'div'" :type="selectable ? 'button' : undefined" class="row"
        :class="{ on: activeKey === it.key, dim: activeKey && activeKey !== it.key }"
        :aria-pressed="selectable ? activeKey === it.key : undefined" @click="selectable && emit('select', it.key)"
      >
        <span class="top">
          <span class="name">{{ it.name }}</span>
          <span class="val">{{ format(it.value) }} <i>{{ share(it.value) }}</i></span>
        </span>
        <span class="track"><span class="fill" :style="{ width: `${(it.value / max) * 100}%` }" /></span>
        <span v-if="it.sub" class="sub">{{ it.sub }}</span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; flex-direction: column; gap: 5px; width: 100%; padding: 8px 10px; border-radius: 10px; text-align: left; border: 1px solid transparent; }
button.row:hover { background: rgba(255, 255, 255, .8); }
.row.on { background: var(--blue-50); border-color: var(--blue-100); }
.row.dim { opacity: .55; }
.top { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.name { font-weight: 600; color: var(--slate-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val { font-weight: 700; color: var(--slate-900); white-space: nowrap; }
.val i { font-style: normal; font-weight: 500; font-size: 11px; color: var(--slate-500); margin-left: 4px; }
.track { height: 8px; border-radius: 9999px; background: var(--slate-100); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 9999px; background: #60a5fa; transition: width .25s ease; }
.row.on .fill { background: var(--blue-600); }
.sub { font-size: 11px; color: var(--slate-500); }
.none { text-align: center; color: var(--slate-500); font-size: 13px; padding: 28px 0; }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>

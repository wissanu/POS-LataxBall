<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 9 },
  disabled: Boolean,
})
const emit = defineEmits(['update:page'])

// 1 … 4 5 [6] 7 8 … 20  (always the first, the last and the neighbours of the current page)
const pages = computed(() => {
  const { page, totalPages } = props
  const keep = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) { keep.add(2); keep.add(3) }
  if (page >= totalPages - 2) { keep.add(totalPages - 1); keep.add(totalPages - 2) }
  const nums = [...keep].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push({ gap: true, key: `gap-${n}` })
    out.push({ n, key: n })
  })
  return out
})
const from = computed(() => (props.total ? (props.page - 1) * props.pageSize + 1 : 0))
const to = computed(() => Math.min(props.page * props.pageSize, props.total))
const go = (n) => { if (!props.disabled && n >= 1 && n <= props.totalPages && n !== props.page) emit('update:page', n) }
</script>

<template>
  <nav class="pager" aria-label="เลือกหน้า">
    <p class="pager__info">แสดง <b>{{ from }}–{{ to }}</b> จาก <b>{{ total }}</b> รายการ</p>
    <div class="pager__nav">
      <button type="button" class="pg pg--arrow" :disabled="disabled || page <= 1" aria-label="หน้าก่อนหน้า" @click="go(page - 1)"><AppIcon name="chevron-left" :size="14" /></button>
      <template v-for="p in pages" :key="p.key">
        <span v-if="p.gap" class="pg pg--gap" aria-hidden="true">…</span>
        <button v-else type="button" class="pg" :class="{ 'pg--on': p.n === page }" :aria-current="p.n === page ? 'page' : undefined" :disabled="disabled" @click="go(p.n)">{{ p.n }}</button>
      </template>
      <button type="button" class="pg pg--arrow" :disabled="disabled || page >= totalPages" aria-label="หน้าถัดไป" @click="go(page + 1)"><AppIcon name="chevron-right" :size="14" /></button>
    </div>
  </nav>
</template>

<style scoped>
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.pager__info { font-size: 12px; color: var(--slate-500); }
.pager__info b { color: var(--slate-800); font-weight: 700; }
.pager__nav { display: flex; align-items: center; gap: 6px; }
.pg { min-width: 32px; height: 32px; padding: 0 8px; display: inline-grid; place-items: center; border-radius: var(--radius-sm); border: 1px solid var(--slate-200); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-700); transition: background .15s, border-color .15s, color .15s; }
button.pg:hover:not(:disabled):not(.pg--on) { background: var(--blue-50); border-color: #93c5fd; color: var(--blue-700); }
.pg--on { background: var(--blue-600); border-color: var(--blue-600); color: #fff; box-shadow: var(--shadow-blue); }
.pg--gap { border-color: transparent; background: none; color: var(--slate-400); }
.pg:disabled { opacity: .45; cursor: not-allowed; }
</style>

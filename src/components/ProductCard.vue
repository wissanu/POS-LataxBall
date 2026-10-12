<script setup>
import LumpImage from './LumpImage.vue'
import { formatNumber } from '@/utils/format'

defineProps({
  product: { type: Object, required: true }, // { id, name, price (บาท/กก.) }
  selectable: Boolean, // โหมดเลือกเพื่อ discard: คลิก = ติ๊กเลือก (ไม่เปิดหน้าเลือกภาชนะ)
  selected: Boolean,
})
defineEmits(['select'])
</script>

<template>
  <button
    type="button" class="card" :class="{ 'card--selected': selected }" :aria-pressed="selectable ? selected : undefined"
    :aria-label="`${product.name} ${formatNumber(product.price)} บาทต่อกิโลกรัม ${selectable ? (selected ? 'เลือกอยู่' : 'เลือกเพื่อ discard') : 'เลือกภาชนะ'}`" @click="$emit('select', product)"
  >
    <span v-if="selectable" class="check" :class="{ 'check--on': selected }" aria-hidden="true">{{ selected ? '✓' : '' }}</span>
    <span class="thumb"><LumpImage /></span>
    <h3>{{ product.name }}</h3>
    <span class="foot">
      <span class="price"><b>{{ formatNumber(product.price) }}</b> <small>บาท / กก.</small></span>
      <span v-if="!selectable" class="add" aria-hidden="true">+</span>
    </span>
  </button>
</template>

<style scoped>
.card {
  position: relative; display: flex; flex-direction: column; width: 100%; text-align: left; padding: 12px;
  background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg);
  box-shadow: 0 1px 1px rgba(0, 0, 0, .05); transition: transform .15s, box-shadow .15s, border-color .15s;
}
.card:hover { transform: translateY(-2px); border-color: #bfdbfe; box-shadow: 0 10px 22px -10px rgba(37, 99, 235, .4); }
.card:active { transform: translateY(0); }
.card--selected { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, .15); }
.check { position: absolute; top: 20px; left: 20px; z-index: 1; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; background: #fff; border: 2px solid var(--slate-300); color: #fff; font-size: 13px; font-weight: 800; line-height: 1; }
.check--on { background: #ef4444; border-color: #ef4444; }
.thumb { display: block; height: 112px; padding: 10px; background: var(--slate-50); border-radius: var(--radius-md); margin-bottom: 12px; }
h3 { font-size: 14px; font-weight: 700; line-height: 1.5; color: var(--slate-800); overflow-wrap: anywhere; }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--slate-100); }
.price b { font-size: 17px; color: var(--blue-600); }
.price small { font-size: 11px; color: var(--slate-500); }
.add { flex: none; width: 28px; height: 28px; border-radius: var(--radius-sm); display: grid; place-items: center; background: var(--blue-50); color: var(--blue-600); font-weight: 700; font-size: 14px; transition: background .15s, color .15s; }
.card:hover .add { background: var(--blue-600); color: #fff; }
</style>

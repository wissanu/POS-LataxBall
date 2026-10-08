<script setup>
import LumpImage from './LumpImage.vue'
import { formatNumber } from '@/utils/format'

defineProps({ product: { type: Object, required: true } }) // { id, name, price (บาท/กก.) }
defineEmits(['select'])
</script>

<template>
  <button type="button" class="card" :aria-label="`${product.name} ${formatNumber(product.price)} บาทต่อกิโลกรัม เลือกภาชนะ`" @click="$emit('select', product)">
    <span class="thumb"><LumpImage /></span>
    <h3>{{ product.name }}</h3>
    <span class="foot">
      <span class="price"><b>{{ formatNumber(product.price) }}</b> <small>บาท / กก.</small></span>
      <span class="add" aria-hidden="true">+</span>
    </span>
  </button>
</template>

<style scoped>
.card {
  display: flex; flex-direction: column; width: 100%; text-align: left; padding: 12px;
  background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg);
  box-shadow: 0 1px 1px rgba(0, 0, 0, .05); transition: transform .15s, box-shadow .15s, border-color .15s;
}
.card:hover { transform: translateY(-2px); border-color: #bfdbfe; box-shadow: 0 10px 22px -10px rgba(37, 99, 235, .4); }
.card:active { transform: translateY(0); }
.thumb { display: block; height: 112px; padding: 10px; background: var(--slate-50); border-radius: var(--radius-md); margin-bottom: 12px; }
h3 { font-size: 14px; font-weight: 700; line-height: 1.5; color: var(--slate-800); overflow-wrap: anywhere; }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--slate-100); }
.price b { font-size: 17px; color: var(--blue-600); }
.price small { font-size: 11px; color: var(--slate-500); }
.add { flex: none; width: 28px; height: 28px; border-radius: var(--radius-sm); display: grid; place-items: center; background: var(--blue-50); color: var(--blue-600); font-weight: 700; font-size: 14px; transition: background .15s, color .15s; }
.card:hover .add { background: var(--blue-600); color: #fff; }
</style>

<script setup>
import { formatMoney } from '@/utils/format'
defineProps({ product: { type: Object, required: true } })
defineEmits(['add'])
</script>

<template>
  <article class="card">
    <div class="thumb">
      <span class="tag" :class="`tag--${product.tagTone}`">{{ product.tag }}</span>
      <span class="emoji" aria-hidden="true">{{ product.emoji }}</span>
    </div>
    <h3>{{ product.name }}</h3>
    <p class="desc">{{ product.description }}</p>
    <footer>
      <strong>{{ formatMoney(product.price) }}</strong>
      <button class="add" type="button" :aria-label="`Add ${product.name}`" @click="$emit('add', product)">+</button>
    </footer>
  </article>
</template>

<style scoped>
.card { background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-lg); padding: 12px;
  display: flex; flex-direction: column; box-shadow: 0 1px 1px rgba(0, 0, 0, .05); }
.thumb { position: relative; background: var(--slate-50); border-radius: var(--radius-md); height: 108px; display: grid; place-items: center; margin-bottom: 12px; }
.emoji { font-size: 36px; line-height: 40px; }
.tag { position: absolute; left: 8px; top: 8px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; }
.tag--blue { background: var(--blue-50); color: var(--blue-700); }
.tag--amber { background: var(--amber-50); color: var(--amber-700); }
.tag--green { background: var(--green-50); color: var(--green-700); }
.tag--rose { background: var(--rose-50); color: var(--rose-700); }
.tag--red { background: var(--red-50); color: var(--red-700); }
.tag--purple { background: var(--purple-50); color: var(--purple-700); }
.tag--sky { background: var(--sky-50); color: var(--sky-700); }
h3 { font-size: 12px; font-weight: 700; color: var(--slate-800); line-height: 16px; }
.desc { font-size: 11px; color: var(--slate-400); line-height: 16.5px; min-height: 33px; margin-top: 1px; }
footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--slate-100); margin-top: 8px; padding-top: 9px; }
strong { font-size: 14px; color: var(--blue-600); }
.add { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--blue-50); color: var(--blue-600); font-weight: 700; font-size: 14px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, .05); transition: background .15s, color .15s; }
.add:hover { background: var(--blue-600); color: #fff; }
</style>

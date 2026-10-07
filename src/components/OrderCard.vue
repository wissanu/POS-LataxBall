<script setup>
import AppIcon from './AppIcon.vue'
import { formatMoney, formatDateTime, initials } from '@/utils/format'

const props = defineProps({ order: { type: Object, required: true }, busy: Boolean })
defineEmits(['accept', 'reject'])

const tones = ['#fecdd3', '#c7d2fe', '#fde68a', '#bbf7d0', '#bae6fd', '#e9d5ff']
const avatarBg = tones[props.order.id % tones.length]
</script>

<template>
  <article class="card">
    <header>
      <div>
        <h3>Order #{{ order.id }}</h3>
        <time :datetime="order.createdAt">{{ formatDateTime(order.createdAt) }}</time>
      </div>
      <span class="avatar" :style="{ background: avatarBg }" :title="order.customer.name">{{ initials(order.customer.name) }}</span>
    </header>

    <ul>
      <li v-for="(it, i) in order.items" :key="i">
        <span class="thumb" aria-hidden="true">{{ it.emoji }}</span>
        <div class="meta">
          <h4>{{ it.name }}</h4>
          <p>{{ it.description }}</p>
        </div>
        <div class="price">
          <strong>{{ formatMoney(it.price) }}</strong>
          <span>Qty: {{ it.qty }}</span>
        </div>
      </li>
    </ul>

    <footer>
      <div>
        <p>+{{ order.extraItems }} items</p>
        <strong>{{ formatMoney(order.total) }}</strong>
      </div>

      <div v-if="order.status === 'pending'" class="actions">
        <button type="button" class="act act--reject" :disabled="busy" aria-label="Reject order" @click="$emit('reject')"><AppIcon name="x" :size="16" /></button>
        <button type="button" class="act act--accept" :disabled="busy" aria-label="Accept order" @click="$emit('accept')"><AppIcon name="check" :size="16" /></button>
      </div>
      <span v-else-if="order.status === 'rejected'" class="pill pill--rejected"><AppIcon name="x" :size="12" /> REJECTED</span>
      <span v-else-if="order.status === 'complete'" class="pill pill--complete"><AppIcon name="check" :size="12" /> COMPLETE</span>
      <span v-else class="pill pill--draft"><AppIcon name="file" :size="12" /> DRAFT</span>
    </footer>
  </article>
</template>

<style scoped>
.card { background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-lg); padding: 17px; box-shadow: 0 1px 2px rgba(0, 0, 0, .05); display: flex; flex-direction: column; gap: 12px; }
header { display: flex; justify-content: space-between; align-items: flex-start; }
h3 { font-size: 16px; font-weight: 700; color: var(--slate-900); line-height: 20px; }
time { font-size: 12px; color: var(--slate-400); }
.avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: var(--slate-800); }
ul { list-style: none; margin: 0; padding: 12px 0 0; border-top: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 12px; }
li { display: flex; align-items: center; gap: 10px; }
.thumb { width: 44px; height: 44px; border-radius: var(--radius-md); background: linear-gradient(135deg, #fef3c7, #dcfce7); display: grid; place-items: center; font-size: 22px; flex: none; }
.meta { flex: 1; min-width: 0; }
h4 { font-size: 14px; font-weight: 600; color: var(--slate-900); line-height: 18px; }
.meta p { font-size: 12px; color: var(--slate-400); }
.price { text-align: right; display: flex; flex-direction: column; }
.price strong { font-size: 14px; color: var(--slate-900); }
.price span { font-size: 12px; color: var(--slate-500); }
footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--slate-100); padding-top: 12px; }
footer p { font-size: 12px; color: var(--slate-500); }
footer strong { font-size: 18px; color: var(--slate-900); }
.actions { display: flex; gap: 8px; }
.act { width: 36px; height: 36px; border-radius: var(--radius-md); display: grid; place-items: center; background: #fff; border: 1px solid; transition: background .15s, color .15s; }
.act--reject { border-color: #fecaca; color: #dc2626; }
.act--reject:hover:not(:disabled) { background: #dc2626; color: #fff; }
.act--accept { border-color: #86efac; color: var(--green-600); }
.act--accept:hover:not(:disabled) { background: var(--green-600); color: #fff; }
.act:disabled { opacity: .5; cursor: not-allowed; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius-md); font-size: 12px; font-weight: 700; border: 1px solid; }
.pill--rejected { background: var(--red-50); color: var(--red-700); border-color: #fecaca; }
.pill--complete { background: #fff; color: var(--green-700); border-color: #86efac; }
.pill--draft { background: var(--slate-50); color: var(--slate-600); border-color: var(--slate-200); }
</style>

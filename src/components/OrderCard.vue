<script setup>
import AppIcon from './AppIcon.vue'
import LumpImage from './LumpImage.vue'
import { computed } from 'vue'
import { formatMoney, formatDateTime, formatKg, initials } from '@/utils/format'

const SHOWN = 3 // การ์ดแสดงสูงสุด 3 รายการ ที่เหลือสรุปเป็น "+N items" (ให้ 3 แถวต่อหน้าสูงเท่ากัน)
const props = defineProps({
  order: { type: Object, required: true },
  busy: Boolean,
  canCancel: Boolean, // มีสิทธิ์ยกเลิกใบที่ยืนยันแล้ว (ผู้จัดการขึ้นไป)
})
defineEmits(['accept', 'reject', 'cancel'])

const shown = computed(() => props.order.items.slice(0, SHOWN))
const extra = computed(() => Math.max(0, props.order.items.length - SHOWN) + (props.order.extraItems || 0))

const tones = ['#fecdd3', '#c7d2fe', '#fde68a', '#bbf7d0', '#bae6fd', '#e9d5ff']
// id is a UUID string: derive a stable colour from its characters
const avatarBg = tones[[...String(props.order.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % tones.length]
</script>

<template>
  <article class="card">
    <header>
      <div>
        <h3>Order #{{ order.no }}</h3>
        <time :datetime="order.createdAt">{{ formatDateTime(order.createdAt) }}</time>
      </div>
      <span class="avatar" :style="{ background: avatarBg }" :title="order.customer.name">{{ initials(order.customer.name) }}</span>
    </header>

    <ul>
      <li v-for="(it, i) in shown" :key="i">
        <span class="thumb" aria-hidden="true"><template v-if="it.emoji">{{ it.emoji }}</template><LumpImage v-else /></span>
        <div class="meta">
          <h4>{{ it.name }}</h4>
          <p>{{ it.description }}</p>
        </div>
        <div class="price">
          <strong>{{ formatMoney(it.price) }}</strong>
          <span>{{ it.netWeight != null ? formatKg(it.netWeight) : `Qty: ${it.qty}` }}</span>
        </div>
      </li>
    </ul>

    <footer>
      <div>
        <p v-if="extra">+{{ extra }} items</p>
        <strong>{{ formatMoney(order.total) }}</strong>
      </div>

      <div v-if="order.status === 'pending'" class="actions">
        <button type="button" class="act act--reject" :disabled="busy" aria-label="Reject order" @click="$emit('reject')"><AppIcon name="x" :size="16" /></button>
        <button type="button" class="act act--accept" :disabled="busy" aria-label="Accept order" @click="$emit('accept')"><AppIcon name="check" :size="16" /></button>
      </div>
      <span v-else-if="order.status === 'rejected'" class="pill pill--rejected"><AppIcon name="x" :size="12" /> REJECTED</span>
      <div v-else-if="order.status === 'complete'" class="actions">
        <button v-if="canCancel" type="button" class="cancel" :disabled="busy" @click="$emit('cancel')">ยกเลิกใบนี้</button>
        <span class="pill pill--complete"><AppIcon name="check" :size="12" /> COMPLETE</span>
      </div>
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
.thumb :deep(.lump) { padding: 4px; }
.meta { flex: 1; min-width: 0; }
h4 { font-size: 14px; font-weight: 600; color: var(--slate-900); line-height: 18px; }
.meta p { font-size: 12px; color: var(--slate-400); }
.price { text-align: right; display: flex; flex-direction: column; }
.price strong { font-size: 14px; color: var(--slate-900); }
.price span { font-size: 12px; color: var(--slate-500); }
footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--slate-100); padding-top: 12px; }
footer p { font-size: 12px; color: var(--slate-500); }
footer strong { font-size: 18px; color: var(--slate-900); }
.actions { display: flex; align-items: center; gap: 8px; }
.cancel { font-size: 11px; font-weight: 600; color: var(--slate-500); padding: 6px 8px; border-radius: var(--radius-sm); text-decoration: underline; text-underline-offset: 2px; }
.cancel:hover:not(:disabled) { color: #dc2626; background: var(--red-50); }
.cancel:disabled { opacity: .5; cursor: not-allowed; }
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

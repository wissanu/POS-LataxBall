<script setup>
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatMoney } from '@/utils/format'

const cart = useCartStore()
const toast = useToast()

const collapsed = ref(false)
const search = ref('')
const editingNote = ref(null) // productId currently being annotated
const noteDraft = ref('')
const busy = ref(false)

const tableTag = computed(() => `T${(cart.table.match(/\d+/) || [''])[0].replace(/^0/, '')}`)
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? cart.items.filter((i) => i.name.toLowerCase().includes(q)) : cart.items
})
const tables = Array.from({ length: 12 }, (_, i) => `Table ${String(i + 1).padStart(2, '0')}`)

function startNote(item) { editingNote.value = item.productId; noteDraft.value = item.note }
function saveNote(item) { cart.setNote(item.productId, noteDraft.value); editingNote.value = null }

async function send(status, message) {
  if (!cart.items.length || busy.value) return
  busy.value = true
  try {
    const order = await cart.submit(status)
    toast.success(`${message} · Order #${order.id}`)
  } catch (e) {
    toast.error(getErrorMessage(e, 'Could not save the order.'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <aside class="panel glass" :class="{ 'panel--collapsed': collapsed }" aria-label="Current order">
    <header class="head">
      <div v-if="!collapsed" class="who">
        <span class="badge">{{ tableTag }}</span>
        <div>
          <h2>Order #{{ cart.orderNo }} <i class="dot" /></h2>
          <p>{{ cart.customer }} • {{ cart.guests }} guests</p>
        </div>
      </div>
      <button class="toggle" type="button" :aria-expanded="!collapsed" :aria-label="collapsed ? 'Expand order panel' : 'Collapse order panel'" @click="collapsed = !collapsed">
        <AppIcon :name="collapsed ? 'chevron-left' : 'chevron-right'" />
      </button>
    </header>

    <template v-if="!collapsed">
      <div class="selectors">
        <label class="search">
          <AppIcon name="search" :size="14" />
          <input v-model="search" placeholder="Search in Existing..." />
        </label>
        <div class="row">
          <label class="select">
            <span class="sr-only">Service type</span>
            <select v-model="cart.serviceType">
              <option>Dine In</option><option>Takeaway</option><option>Delivery</option>
            </select>
            <AppIcon name="chevron-down" :size="14" />
          </label>
          <label class="select">
            <span class="sr-only">Table</span>
            <select v-model="cart.table">
              <option v-for="t in tables" :key="t">{{ t }}</option>
            </select>
            <AppIcon name="chevron-down" :size="14" />
          </label>
        </div>
      </div>

      <ul class="items scroll-y">
        <li v-if="!shown.length" class="empty">
          {{ cart.items.length ? 'No matching items.' : 'No items yet. Tap + on a dish to add it.' }}
        </li>
        <li v-for="item in shown" :key="item.productId" class="item">
          <div class="item__top">
            <div>
              <h4>{{ item.name }}</h4>
              <p>{{ formatMoney(item.price) }} × {{ item.qty }} = {{ formatMoney(item.price * item.qty) }}</p>
            </div>
            <button type="button" class="icon-btn" :aria-label="`Remove ${item.name}`" @click="cart.remove(item.productId)">
              <AppIcon name="trash" :size="14" />
            </button>
          </div>
          <div class="item__bottom">
            <div class="stepper">
              <button type="button" :aria-label="`Decrease ${item.name}`" @click="cart.decrement(item.productId)">−</button>
              <span>{{ item.qty }}</span>
              <button type="button" :aria-label="`Increase ${item.name}`" @click="cart.increment(item.productId)">+</button>
            </div>
            <input
              v-if="editingNote === item.productId" v-model="noteDraft" class="note-input" maxlength="40" autofocus
              placeholder="e.g. Less sauce" @keydown.enter="saveNote(item)" @blur="saveNote(item)"
            />
            <button v-else-if="item.note" type="button" class="note-chip" @click="startNote(item)">{{ item.note }}</button>
            <button v-else type="button" class="add-note" @click="startNote(item)"><AppIcon name="edit" :size="12" /> Add Notes</button>
          </div>
        </li>
      </ul>

      <dl class="summary">
        <div><dt>Sub total :</dt><dd>{{ formatMoney(cart.subtotal) }}</dd></div>
        <div><dt>Product Discount :</dt><dd>{{ formatMoney(cart.productDiscount) }}</dd></div>
        <div><dt>Extra Discount :</dt><dd>{{ formatMoney(cart.extraDiscount) }}</dd></div>
        <div><dt>Coupon discount :</dt><dd>{{ formatMoney(cart.couponDiscount) }}</dd></div>
        <div class="total"><dt>Total :</dt><dd>{{ formatMoney(cart.total) }}</dd></div>
      </dl>

      <div class="actions">
        <BaseButton variant="dark" size="sm" :loading="busy" :disabled="!cart.items.length" @click="send('pending', 'Sent to kitchen')">KOT &amp; Print</BaseButton>
        <BaseButton variant="soft" size="sm" :disabled="!cart.items.length" @click="send('draft', 'Saved as draft')"><AppIcon name="file" :size="14" /> Draft</BaseButton>
        <BaseButton variant="primary" :disabled="!cart.items.length" @click="send('pending', 'Ready for payment')"><AppIcon name="wallet" /> Bill &amp; Payment</BaseButton>
        <BaseButton variant="success" :disabled="!cart.items.length" @click="send('pending', 'Bill printed')"><AppIcon name="printer" /> Bill &amp; Print</BaseButton>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.panel { width: 384px; flex: none; padding: 17px; display: flex; flex-direction: column; background: var(--glass-strong); transition: width .2s; min-height: 0; }
.panel--collapsed { width: 62px; padding: 17px 12px; }
.head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 13px; border-bottom: 1px solid rgba(226, 232, 240, .6); }
.panel--collapsed .head { border: 0; justify-content: center; }
.who { display: flex; gap: 10px; align-items: center; }
.badge { width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--blue-100); color: var(--blue-700); font-weight: 700; font-size: 12px; display: grid; place-items: center; }
h2 { font-size: 12px; font-weight: 700; color: var(--slate-900); display: flex; align-items: center; gap: 6px; line-height: 16px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; }
.who p { font-size: 11px; color: var(--slate-400); }
.toggle { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--slate-100); display: grid; place-items: center; color: var(--slate-600); }

.selectors { display: flex; flex-direction: column; gap: 8px; padding: 10px 0; }
.search, .select { position: relative; display: flex; align-items: center; background: var(--slate-50); border: 1px solid rgba(226, 232, 240, .8); border-radius: var(--radius-md); color: var(--slate-400); }
.search { padding: 0 12px; gap: 8px; height: 32px; }
.search input { flex: 1; border: 0; background: none; outline: none; font-size: 12px; color: var(--slate-800); }
.row { display: flex; gap: 8px; }
.select { flex: 1; height: 32px; padding: 0 9px; }
.select select { appearance: none; border: 0; background: none; outline: none; width: 100%; font-size: 12px; font-weight: 500; color: var(--slate-700); padding-right: 20px; cursor: pointer; }
.select svg { position: absolute; right: 9px; pointer-events: none; }

.items { flex: 1; min-height: 0; list-style: none; margin: 0; padding: 4px 4px 4px 0; display: flex; flex-direction: column; gap: 8px; }
.empty { text-align: center; color: var(--slate-400); font-size: 12px; padding: 32px 12px; }
.item { background: rgba(248, 250, 252, .7); border: 1px solid var(--slate-100); border-radius: var(--radius-md); padding: 11px; display: flex; flex-direction: column; gap: 8px; }
.item__top { display: flex; justify-content: space-between; align-items: flex-start; }
.item h4 { font-size: 12px; font-weight: 700; color: var(--slate-800); line-height: 16px; }
.item p { font-size: 11px; font-weight: 600; color: var(--blue-600); }
.icon-btn { padding: 4px; color: var(--slate-400); border-radius: 6px; }
.icon-btn:hover { color: #dc2626; background: var(--red-50); }
.item__bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; gap: 8px; }
.stepper { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-sm); padding: 3px 5px; }
.stepper button { width: 20px; height: 20px; font-weight: 700; font-size: 12px; color: var(--slate-500); border-radius: 4px; }
.stepper button:hover { background: var(--slate-100); }
.stepper span { min-width: 12px; text-align: center; font-weight: 700; font-size: 12px; }
.add-note { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; color: var(--slate-500); }
.add-note:hover { color: var(--blue-600); }
.note-chip { background: var(--amber-50); color: var(--amber-600); font-size: 10px; padding: 2px 6px; border-radius: 4px; }
.note-input { width: 120px; font-size: 11px; padding: 4px 8px; border: 1px solid var(--blue-600); border-radius: 6px; outline: none; }

.summary { margin: 0; border-top: 1px solid rgba(226, 232, 240, .8); padding-top: 11px; display: flex; flex-direction: column; gap: 6px; }
.summary div { display: flex; justify-content: space-between; font-size: 12px; }
.summary dt { color: var(--slate-500); }
.summary dd { margin: 0; font-weight: 600; color: var(--slate-800); }
.summary .total { border-top: 1px dashed var(--slate-200); padding-top: 7px; align-items: baseline; }
.summary .total dt { font-size: 14px; font-weight: 700; color: var(--slate-900); }
.summary .total dd { font-size: 18px; font-weight: 700; color: var(--blue-600); }

.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 12px; }
</style>

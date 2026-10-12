<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import OrderCard from '@/components/OrderCard.vue'
import { useOrderStore } from '@/stores/orders'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'

const orders = useOrderStore()
const toast = useToast()
const menuOpen = ref(false)
const busyId = ref(null)

const filters = [
  { v: 'all', label: 'All orders' },
  { v: 'pending', label: 'Pending' },
  { v: 'complete', label: 'Complete' },
  { v: 'rejected', label: 'Rejected' },
  { v: 'draft', label: 'Drafts' },
]
const chipIcon = { complete: 'check', rejected: 'x', pending: 'clock' }

onMounted(() => {
  orders.load()
  orders.startPolling() // รับรายการที่ส่งมาจากหน้า New Order แบบต่อเนื่อง
})
onBeforeUnmount(() => orders.stopPolling())
// ไม่แสดง error ในพื้นที่รายการ — แจ้งด้วย toast ครั้งเดียวเมื่อมีปัญหา
watch(() => orders.error, (m) => m && toast.error(m))

async function setStatus(order, status) {
  busyId.value = order.id
  try {
    await orders.setStatus(order.id, status)
    toast.success(`Order #${order.no} ${status === 'complete' ? 'accepted' : 'rejected'}`)
  } catch (e) {
    toast.error(getErrorMessage(e, 'Could not update the order.'))
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <section class="orders glass">
    <header class="head">
      <div>
        <h1>รายการรับซื้อสินค้า</h1>
        <p>รับข้อมูล รายการรับซื้อสินค้า แบบต่อเนื่อง</p>
      </div>
      <div class="filter">
        <button type="button" class="filter__btn" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><AppIcon name="filter" :size="14" /> Filter</button>
        <ul v-if="menuOpen" class="filter__menu" role="menu">
          <li v-for="f in filters" :key="f.v">
            <button type="button" role="menuitemradio" :aria-checked="orders.statusFilter === f.v" :class="{ on: orders.statusFilter === f.v }" @click="(orders.statusFilter = f.v), (menuOpen = false)">{{ f.label }}</button>
          </li>
        </ul>
      </div>
    </header>

    <div class="queue" aria-label="Recent tickets">
      <span v-for="c in orders.queue" :key="c.id" class="chip" :class="`chip--${c.status}`"><AppIcon :name="chipIcon[c.status]" :size="12" /> #{{ c.no }}</span>
    </div>

    <p v-if="orders.loading" class="state">Loading orders…</p>
    <p v-else-if="!orders.visible.length" class="state">ยังไม่ได้รับรายการ</p>
    <div v-else class="grid">
      <OrderCard v-for="o in orders.visible" :key="o.id" :order="o" :busy="busyId === o.id" @accept="setStatus(o, 'complete')" @reject="setStatus(o, 'rejected')" />
    </div>
  </section>
</template>

<style scoped>
.orders { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; padding: 20px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 16px; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }
.filter { position: relative; }
.filter__btn { display: flex; align-items: center; gap: 8px; padding: 8px 13px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-700); }
.filter__menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; margin: 0; padding: 6px; list-style: none; min-width: 150px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); box-shadow: var(--shadow-panel); }
.filter__menu button { width: 100%; text-align: left; padding: 8px 10px; font-size: 12px; border-radius: 8px; color: var(--slate-700); }
.filter__menu button:hover { background: var(--slate-50); }
.filter__menu button.on { color: var(--blue-700); font-weight: 700; background: var(--blue-50); }
.queue { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 18px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 13px; border-radius: 9999px; font-size: 12px; font-weight: 600; border: 1px solid; }
.chip--complete { background: #f0fdf4; color: #15803d; border-color: #86efac; }
.chip--rejected { background: #fdf2f8; color: #be185d; border-color: #f9a8d4; }
.chip--pending { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr)); gap: 16px; padding-bottom: 16px; }
.state { text-align: center; color: var(--slate-500); font-size: 13px; padding: 64px 0; }
.state--error { color: #dc2626; }
.state button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
@media (max-width: 700px) {
  .orders { padding: 16px; }
  .head { gap: 12px; }
  h1 { font-size: 21px; }
  .queue { gap: 8px; }
}
</style>

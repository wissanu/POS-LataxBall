<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import OrderCard from '@/components/OrderCard.vue'
import Pagination from '@/components/Pagination.vue'
import { useAuthStore } from '@/stores/auth'
import { PAGE_SIZE, useOrderStore } from '@/stores/orders'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatThaiStamp } from '@/utils/dates'

const orders = useOrderStore()
const auth = useAuthStore()
const toast = useToast()
const menuOpen = ref(false)
const busyId = ref(null)
const canCancel = computed(() => auth.can('purchase.cancel')) // ยกเลิกใบที่ยืนยันแล้ว = ผู้จัดการขึ้นไป

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
onBeforeUnmount(() => {
  orders.stopPolling()
  orders.resetView() // ออกจากหน้านี้ = กลับไปโหมด "วันนี้" ไม่ค้างตัวกรองการค้นหา
})
// ไม่แสดง error ในพื้นที่รายการ — แจ้งด้วย toast ครั้งเดียวเมื่อมีปัญหา
watch(() => orders.error, (m) => m && toast.error(m))

// ---- toggle: เฉพาะวันนี้ <-> ทุกวัน (ระหว่างค้นหาจะค้นทุกวันเสมอ จึงล็อกไว้) ----
const allDays = computed(() => orders.effectiveScope === 'all')
const toggleScope = () => { if (!orders.hasSearch) orders.setScope(allDays.value ? 'today' : 'all') }

// ---- ป้ายตัวกรองที่กำลังค้นหา ----
const tags = computed(() => {
  const s = orders.search
  const out = []
  if (s.no) out.push({ key: 'no', label: `เลขที่ ${s.no}` })
  if (s.customer) out.push({ key: 'customer', label: `ลูกค้า: ${s.customer.name}${s.customer.code ? ` (${s.customer.code})` : ''}` })
  if (s.from || s.to) out.push({ key: 'range', label: `ช่วง: ${s.from ? formatThaiStamp(s.from) : 'ตั้งแต่เริ่มต้น'} – ${s.to ? formatThaiStamp(s.to) : 'ปัจจุบัน'}` })
  return out
})

// ---- ชิป "รายการล่าสุด": บรรทัดเดียว เลื่อนซ้าย-ขวาได้ (ซ่อนแถบเลื่อน) ด้วยล้อเมาส์หรือการลาก ----
const queueEl = ref(null)
function onWheel(e) {
  const el = queueEl.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    el.scrollLeft += e.deltaY
    e.preventDefault()
  }
}
let drag = null
const dragging = ref(false)
function dragStart(e) {
  if (e.pointerType !== 'mouse' || e.button !== 0 || !queueEl.value) return
  drag = { x: e.clientX, left: queueEl.value.scrollLeft }
  window.addEventListener('pointermove', dragMove)
  window.addEventListener('pointerup', dragEnd)
}
function dragMove(e) {
  if (!drag) return
  if (Math.abs(e.clientX - drag.x) > 3) dragging.value = true
  queueEl.value.scrollLeft = drag.left - (e.clientX - drag.x)
}
function dragEnd() {
  drag = null
  dragging.value = false
  window.removeEventListener('pointermove', dragMove)
  window.removeEventListener('pointerup', dragEnd)
}
onBeforeUnmount(dragEnd)

// ---- accept / reject / cancel ----
async function setStatus(order, status, label) {
  busyId.value = order.id
  try {
    await orders.setStatus(order.id, status)
    toast.success(`Order #${order.no} ${label ?? (status === 'complete' ? 'accepted' : 'rejected')}`)
  } catch (e) {
    toast.error(getErrorMessage(e, 'Could not update the order.'))
  } finally {
    busyId.value = null
  }
}
const cancelTarget = ref(null)
const cancelOpen = computed({ get: () => !!cancelTarget.value, set: (v) => { if (!v) cancelTarget.value = null } })
async function confirmCancel() {
  const o = cancelTarget.value
  cancelTarget.value = null
  if (o) await setStatus(o, 'rejected', 'cancelled')
}

const emptyText = computed(() =>
  orders.hasSearch ? 'ไม่พบใบรับซื้อที่ตรงกับการค้นหา'
  : orders.statusFilter !== 'all' ? 'ไม่มีรายการในสถานะนี้'
  : allDays.value ? 'ยังไม่มีรายการรับซื้อ' : 'ยังไม่ได้รับรายการของวันนี้',
)
</script>

<template>
  <section class="orders glass">
    <header class="head">
      <div>
        <h1>รายการรับซื้อสินค้า</h1>
        <p>รับข้อมูล รายการรับซื้อสินค้า แบบต่อเนื่อง</p>
      </div>
      <div class="tools">
        <!-- 5) toggle: เฉพาะวันนี้ <-> ทุกรายการ -->
        <button
          type="button" class="scope" role="switch" :aria-checked="allDays" :disabled="orders.hasSearch"
          :title="orders.hasSearch ? 'กำลังค้นหา: ค้นข้ามทุกวัน' : allDays ? 'กดเพื่อดูเฉพาะวันนี้' : 'กดเพื่อดูทุกรายการ (หาใบย้อนหลัง)'" @click="toggleScope"
        >
          <span class="scope__txt" :class="{ on: !allDays }">วันนี้</span>
          <span class="scope__track" :class="{ all: allDays }" aria-hidden="true"><i /></span>
          <span class="scope__txt" :class="{ on: allDays }">ทุกวัน</span>
        </button>
        <div class="filter">
          <button type="button" class="filter__btn" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><AppIcon name="filter" :size="14" /> Filter</button>
          <ul v-if="menuOpen" class="filter__menu" role="menu">
            <li v-for="f in filters" :key="f.v">
              <button type="button" role="menuitemradio" :aria-checked="orders.statusFilter === f.v" :class="{ on: orders.statusFilter === f.v }" @click="(orders.setStatusFilter(f.v), (menuOpen = false))">{{ f.label }}</button>
            </li>
          </ul>
        </div>
      </div>
    </header>

    <!-- ตัวกรองจากช่องค้นหา -->
    <div v-if="orders.hasSearch" class="active" aria-label="เงื่อนไขการค้นหา">
      <span class="active__lead"><AppIcon name="search" :size="13" /> ผลการค้นหา (ทุกวัน) · {{ orders.total }} ใบ</span>
      <button v-for="t in tags" :key="t.key" type="button" class="tag" :title="`ลบเงื่อนไข: ${t.label}`" @click="orders.removeSearch(t.key)">{{ t.label }} <AppIcon name="x" :size="12" /></button>
      <button type="button" class="active__clear" @click="orders.clearSearch()">ล้างทั้งหมด</button>
    </div>

    <!-- 3) รายการล่าสุด: บรรทัดเดียว เลื่อนไปทางขวา -->
    <div v-if="orders.queue.length" ref="queueEl" class="queue" :class="{ 'queue--drag': dragging }" aria-label="Recent tickets" @wheel="onWheel" @pointerdown="dragStart">
      <span v-for="c in orders.queue" :key="c.id" class="chip" :class="`chip--${c.status}`"><AppIcon :name="chipIcon[c.status]" :size="12" /> #{{ c.no }}</span>
    </div>

    <!-- 2) 3 แถว x 3 หลัก ต่อหน้า -->
    <div class="scroll">
      <p v-if="orders.loading" class="state">Loading orders…</p>
      <p v-else-if="!orders.list.length" class="state">{{ emptyText }}</p>
      <div v-else class="grid" :aria-busy="orders.loading">
        <OrderCard
          v-for="o in orders.list" :key="o.id" :order="o" :busy="busyId === o.id" :can-cancel="canCancel"
          @accept="setStatus(o, 'complete')" @reject="setStatus(o, 'rejected')" @cancel="cancelTarget = o"
        />
      </div>
    </div>

    <footer v-if="orders.total > 0" class="foot">
      <Pagination :page="orders.page" :total-pages="orders.totalPages" :total="orders.total" :page-size="PAGE_SIZE" :disabled="orders.loading" @update:page="orders.goPage" />
    </footer>

    <BaseModal v-model="cancelOpen" title="ยกเลิกใบรับซื้อที่ยืนยันแล้ว" width="420px">
      <p class="confirm">ต้องการยกเลิก <b>#{{ cancelTarget?.no }}</b> ใช่ไหม? ใบที่ยกเลิกแล้วจะไม่นับในรายงานยอดขาย และกลับมายืนยันใหม่ไม่ได้</p>
      <template #footer>
        <BaseButton variant="soft" @click="cancelOpen = false">ไม่ยกเลิก</BaseButton>
        <BaseButton variant="dark" @click="confirmCancel">ยกเลิกใบนี้</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.orders { flex: 1; min-width: 0; min-height: 0; padding: 20px; display: flex; flex-direction: column; overflow: hidden; }
.head { flex: none; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 16px; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }
.tools { display: flex; align-items: center; gap: 10px; }

.scope { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-400); }
.scope:disabled { cursor: not-allowed; opacity: .75; }
.scope__txt.on { color: var(--blue-700); font-weight: 700; }
.scope__track { position: relative; width: 34px; height: 20px; border-radius: 9999px; background: var(--slate-300); transition: background .2s; }
.scope__track i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .25); transition: transform .2s; }
.scope__track.all { background: var(--blue-600); }
.scope__track.all i { transform: translateX(14px); }
@media (prefers-reduced-motion: reduce) { .scope__track, .scope__track i { transition: none; } }

.filter { position: relative; }
.filter__btn { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 13px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-700); }
.filter__menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; margin: 0; padding: 6px; list-style: none; min-width: 150px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); box-shadow: var(--shadow-panel); }
.filter__menu button { width: 100%; text-align: left; padding: 8px 10px; font-size: 12px; border-radius: 8px; color: var(--slate-700); }
.filter__menu button:hover { background: var(--slate-50); }
.filter__menu button.on { color: var(--blue-700); font-weight: 700; background: var(--blue-50); }

.active { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; padding: 8px 12px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); }
.active__lead { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--blue-700); }
.tag { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 9999px; background: #fff; border: 1px solid #93c5fd; color: var(--blue-700); font-size: 12px; font-weight: 600; }
.tag:hover { background: var(--red-50); border-color: #fecaca; color: #dc2626; }
.active__clear { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--slate-600); text-decoration: underline; text-underline-offset: 2px; }
.active__clear:hover { color: #dc2626; }

/* ชิปรายการล่าสุด: บรรทัดเดียวยาวไปทางขวา ซ่อนแถบเลื่อน */
.queue { flex: none; display: flex; flex-wrap: nowrap; gap: 10px; margin: 14px 0 16px; padding: 2px 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; cursor: grab; overscroll-behavior-x: contain; }
.queue::-webkit-scrollbar { display: none; }
.queue--drag { cursor: grabbing; user-select: none; }
.chip { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 4px 13px; border-radius: 9999px; font-size: 12px; font-weight: 600; border: 1px solid; white-space: nowrap; }
.chip--complete { background: #f0fdf4; color: #15803d; border-color: #86efac; }
.chip--rejected { background: #fdf2f8; color: #be185d; border-color: #f9a8d4; }
.chip--pending { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; }

.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 2px 8px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
.state { text-align: center; color: var(--slate-500); font-size: 13px; padding: 64px 0; }
.foot { flex: none; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(226, 232, 240, .8); }
.confirm { font-size: 13px; line-height: 1.7; color: var(--slate-700); }
@media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) {
  .orders { padding: 16px; }
  .head { flex-wrap: wrap; }
  h1 { font-size: 21px; }
  .grid { grid-template-columns: minmax(0, 1fr); }
}
</style>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import OrdersTable from '@/components/OrdersTable.vue'
import Pagination from '@/components/Pagination.vue'
import ReceiptModal from '@/components/ReceiptModal.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { PAGE_SIZE, RANGES, SALE_FILTERS, useOrderStore } from '@/stores/orders'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { addDays, bangkokDate, formatThaiDate, formatThaiStamp } from '@/utils/dates'
import { formatMoney, formatNumber } from '@/utils/format'

const orders = useOrderStore()
const auth = useAuthStore()
const toast = useToast()
const menuOpen = ref(false)
const router = useRouter()

// ---- ทำบิลย้อนหลัง: เลือกวัน แล้วไปหน้ารับออเดอร์ใหม่ ที่ใช้ราคา/ลงวันที่ของวันนั้น ----
const backOpen = ref(false)
const backDate = ref('')
const backMax = computed(() => addDays(bangkokDate(), -1))
const backMin = computed(() => addDays(bangkokDate(), -366))
const canCreate = computed(() => auth.can('purchase.create'))
function openBack() { backDate.value = backMax.value; backOpen.value = true }
function goBack() {
  if (!backDate.value || backDate.value > backMax.value || backDate.value < backMin.value) return toast.error('เลือกวันที่ผ่านมาแล้ว (ย้อนหลังได้ไม่เกิน 366 วัน)')
  backOpen.value = false
  router.push({ name: 'new-order', query: { date: backDate.value } })
}

// แถบยอดรวม: รายละเอียดแยกประเภทลอยขึ้นเมื่อเลื่อนเมาส์ไปที่แถบ (เฉพาะอุปกรณ์ที่มีเมาส์) หรือกดที่แถบเพื่อค้างไว้/ปิด
const pinned = ref(false)
const hovering = ref(false)
let hoverTimer = null
const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches
const detailOpen = computed(() => pinned.value || hovering.value)
function hoverIn() { if (!canHover()) return; clearTimeout(hoverTimer); hoverTimer = setTimeout(() => { hovering.value = true }, 120) }
function hoverOut() { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => { hovering.value = false }, 200) }
onBeforeUnmount(() => clearTimeout(hoverTimer))
const busyId = ref(null)
const canCancel = computed(() => auth.can('purchase.cancel')) // ยกเลิกใบที่ยืนยันแล้ว = ผู้จัดการขึ้นไป

// ชื่อในตารางสรุป: ลูกค้าประจำ = ชื่อในทะเบียน · ทั่วไป/สวน = ชื่อที่กรอก (ไม่กรอก = ไม่ระบุชื่อ)
const custLabel = (c) => (c.type === 'member' ? c.name : c.name || (c.type === 'garden' ? 'สวน (ไม่ระบุชื่อ)' : 'ลูกค้าทั่วไป (ไม่ระบุชื่อ)'))

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
  orders.startPolling() // รับรายการที่ส่งมาจากหน้ารับออเดอร์ใหม่ แบบต่อเนื่อง
})
onBeforeUnmount(() => {
  orders.stopPolling()
  orders.resetView() // ออกจากหน้านี้ = กลับไปโหมด "วันนี้" ไม่ค้างตัวกรองการค้นหา
})
// ไม่แสดง error ในพื้นที่รายการ — แจ้งด้วย toast ครั้งเดียวเมื่อมีปัญหา
watch(() => orders.error, (m) => m && toast.error(m))

// ---- ช่วงเวลา: วันนี้ / เดือนนี้ (ไม่มี "ทุกวัน" แบบไม่จำกัด · ระหว่างค้นหาจะค้นข้ามทุกวันเอง จึงล็อกไว้) ----
const windowText = computed(() => {
  const { windowFrom: f, windowTo: t } = orders
  if (!f || !t) return ''
  return f === t ? formatThaiDate(f) : `${formatThaiDate(f)} – ${formatThaiDate(t)}`
})

// ---- ป้ายตัวกรองที่กำลังค้นหา ----
const tags = computed(() => {
  const s = orders.search
  const out = []
  if (s.no) out.push({ key: 'no', label: `เลขที่ ${s.no}` })
  if (s.customer) out.push({ key: 'customer', label: s.customer.named ? `ชื่อ: ${s.customer.name}` : `ลูกค้า: ${s.customer.name}${s.customer.code ? ` (${s.customer.code})` : ''}` })
  if (orders.saleFilter !== 'all') out.push({ key: 'sale', label: `การขาย: ${SALE_FILTERS.find((f) => f.v === orders.saleFilter)?.label.replace(' (รอจัดส่ง + กำลังจัดส่ง)', '')}` })
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
    return true
  } catch (e) {
    toast.error(getErrorMessage(e, 'Could not update the order.'))
    return false
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

// ---- ใบเสร็จ: กด ✓ → พรีวิว → ปริ๊น → (ยืนยันใบ) → ถามว่าจะจ่ายเงินไหม ----
const receiptOrder = ref(null)
const receiptOpen = ref(false)
const payOpen = ref(false)
function openReceipt(order) { receiptOrder.value = order; receiptOpen.value = true }
async function afterReceipt(order) {
  // ปริ๊นแล้ว (หรือเลือกยืนยันโดยไม่พิมพ์) → ยืนยันใบ ถ้าสำเร็จจึงถามเรื่องจ่ายเงิน
  if (await setStatus(order, 'complete')) {
    receiptOpen.value = false
    payOpen.value = true
  }
}
// ตอบ "ใช่" หรือ "ไม่ใช่" = ปิดทุกหน้าต่างไว้ก่อน (ขั้นตอนจ่ายเงินจะต่อในภายหลัง)
function answerPay() {
  payOpen.value = false
  receiptOpen.value = false
}

const emptyText = computed(() =>
  orders.hasSearch ? 'ไม่พบใบรับซื้อที่ตรงกับการค้นหา'
  : orders.statusFilter !== 'all' || orders.saleFilter !== 'all' ? 'ไม่มีรายการในสถานะนี้'
  : orders.range === 'today' ? 'ยังไม่ได้รับรายการของวันนี้' : 'ยังไม่มีรายการรับซื้อในช่วงนี้',
)
</script>

<template>
  <section class="orders glass">
    <header class="head">
      <div>
        <h1>รายการออเดอร์</h1>
        <p>รับข้อมูลรายการออเดอร์แบบต่อเนื่อง<template v-if="!orders.hasSearch && windowText"> · แสดง {{ windowText }}</template></p>
      </div>
      <div class="tools">
        <button v-if="canCreate" type="button" class="filter__btn" @click="openBack"><AppIcon name="clock" :size="14" /> ทำบิลย้อนหลัง</button>
        <!-- ช่วงเวลา: วันนี้ / เดือนนี้ — อยากดูย้อนหลังกว่านั้นให้ใช้ช่องค้นหาด้านบน (เลขที่ใบ / ลูกค้า / ช่วงวันเวลา) -->
        <div class="range" role="radiogroup" aria-label="ช่วงเวลา" :title="orders.hasSearch ? 'กำลังค้นหา: ค้นข้ามทุกวัน' : 'อยากดูย้อนหลังกว่านี้ ให้ค้นหาที่ช่องค้นหาด้านบน'">
          <button
            v-for="r in RANGES" :key="r.v" type="button" role="radio" class="range__btn" :class="{ on: !orders.hasSearch && orders.range === r.v }"
            :aria-checked="!orders.hasSearch && orders.range === r.v" :disabled="orders.hasSearch" @click="orders.setRange(r.v)"
          >{{ r.label }}</button>
        </div>
        <div class="filter">
          <button type="button" class="filter__btn" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><AppIcon name="filter" :size="14" /> Filter</button>
          <ul v-if="menuOpen" class="filter__menu" role="menu">
            <li class="filter__grp">สถานะใบ</li>
            <li v-for="f in filters" :key="f.v">
              <button type="button" role="menuitemradio" :aria-checked="orders.statusFilter === f.v" :class="{ on: orders.statusFilter === f.v }" @click="(orders.setStatusFilter(f.v), (menuOpen = false))">{{ f.label }}</button>
            </li>
            <li class="filter__grp">สถานะการขายให้โรงงาน</li>
            <li v-for="f in SALE_FILTERS" :key="f.v">
              <button type="button" role="menuitemradio" :aria-checked="orders.saleFilter === f.v" :class="{ on: orders.saleFilter === f.v }" @click="(orders.setSaleFilter(f.v), (menuOpen = false))">{{ f.label }}</button>
            </li>
          </ul>
        </div>
      </div>
    </header>

    <BaseModal v-model="backOpen" title="ทำบิลย้อนหลัง" width="420px">
      <p class="bk__txt">เลือกวันที่ต้องการลงบิล ระบบจะไปหน้ารับออเดอร์ใหม่ ของวันนั้น (ใช้ราคารับซื้อของวันนั้น · เลขที่และวันที่ของบิลเป็นของวันนั้น)</p>
      <label class="bk__f"><span>วันที่ลงบิล</span><input v-model="backDate" type="date" :min="backMin" :max="backMax" /></label>
      <template #footer>
        <BaseButton variant="soft" @click="backOpen = false">ยกเลิก</BaseButton>
        <BaseButton @click="goBack">ไปทำบิล</BaseButton>
      </template>
    </BaseModal>

    <!-- ตัวกรองจากช่องค้นหา -->
    <div v-if="orders.hasSearch || orders.saleFilter !== 'all'" class="active" aria-label="เงื่อนไขการค้นหา">
      <span class="active__lead"><AppIcon name="search" :size="13" /> {{ orders.hasSearch ? 'ผลการค้นหา (ทุกวัน)' : 'ตัวกรอง' }} · {{ orders.total }} ใบ</span>
      <button v-for="t in tags" :key="t.key" type="button" class="tag" :title="`ลบเงื่อนไข: ${t.label}`" @click="t.key === 'sale' ? orders.setSaleFilter('all') : orders.removeSearch(t.key)">{{ t.label }} <AppIcon name="x" :size="12" /></button>
      <button type="button" class="active__clear" @click="orders.clearSearch()">ล้างทั้งหมด</button>
    </div>

    <!-- 3) รายการล่าสุด: บรรทัดเดียว เลื่อนไปทางขวา -->
    <div v-if="orders.queue.length" ref="queueEl" class="queue" :class="{ 'queue--drag': dragging }" aria-label="Recent tickets" @wheel="onWheel" @pointerdown="dragStart">
      <span v-for="c in orders.queue" :key="c.id" class="chip" :class="`chip--${c.status}`"><AppIcon :name="chipIcon[c.status]" :size="12" /> #{{ c.no }}</span>
    </div>

    <!-- ตาราง: 1 ใบ = 1 แถว สูงเท่ากัน · คลิกแถวเพื่อดูรายละเอียดรายการ -->
    <div class="scroll">
      <p v-if="orders.loading" class="state">Loading orders…</p>
      <p v-else-if="!orders.list.length" class="state">{{ emptyText }}<template v-if="!orders.hasSearch"><br /><small>ต้องการใบย้อนหลัง? ค้นหาเลขที่ใบ ลูกค้า หรือช่วงวันเวลาที่ช่องค้นหาด้านบน</small></template></p>
      <OrdersTable
        v-else :orders="orders.list" :busy-id="busyId" :can-cancel="canCancel" :aria-busy="orders.loading"
        @accept="openReceipt" @reprint="openReceipt" @reject="setStatus($event, 'rejected')" @cancel="cancelTarget = $event"
      />
    </div>

    <!-- ยอดรวมของตัวกรองปัจจุบัน (ทุกหน้า) อยู่บรรทัดเดียวกับ "แสดง 1–N จาก N รายการ" เพื่อให้ตารางเห็นได้ 6 แถว
         รายละเอียดแยกประเภทลอยขึ้นเมื่อเลื่อนเมาส์ไปที่แถบ หรือกดที่แถบเพื่อค้างไว้ -->
    <footer v-if="orders.total > 0" class="foot">
      <Pagination :page="orders.page" :total-pages="orders.totalPages" :total="orders.total" :page-size="PAGE_SIZE" :disabled="orders.loading" @update:page="orders.goPage">
        <template #middle>
      <div class="sb" @mouseenter="hoverIn" @mouseleave="hoverOut" @focusin="hovering = true" @focusout="hoverOut">
            <div v-if="detailOpen" id="sum-detail" class="sb__pop" role="region" aria-label="ยอดรวมแยกประเภทสินค้า">
              <p class="sb__ctx">{{ orders.hasSearch ? 'ผลการค้นหา' : windowText }}{{ orders.statusFilter !== 'all' ? ` · ${filters.find((f) => f.v === orders.statusFilter)?.label}` : '' }}{{ orders.saleFilter !== 'all' ? ` · ${SALE_FILTERS.find((f) => f.v === orders.saleFilter)?.label}` : '' }} <span v-if="orders.summary.excluded">· ไม่รวม {{ orders.summary.excluded }} ใบ (ยกเลิก / ฉบับร่าง)</span></p>
              <div class="sb__types">
                <div v-for="t in orders.summary.byProduct" :key="t.productType" class="type" :class="{ 'type--foam': t.productType === 'FOAM', 'type--zero': !t.bills }">
                  <span class="type__name">{{ t.label }}<small>{{ t.bills }} ใบ</small></span>
                  <span class="type__kg">{{ formatNumber(t.netKg) }} <i>กก.</i></span>
                  <b class="type__amt">{{ formatMoney(t.amount) }}</b>
                </div>
                <div v-if="orders.summary.adjustment" class="type type--adj" title="เพิ่มราคา และส่วนที่หักของสวน ไม่ผูกกับประเภทสินค้า">
                  <span class="type__name">เพิ่มราคา / หักส่วนของสวน<small>รวมในยอดเงินรวม</small></span>
                  <b class="type__amt">{{ orders.summary.adjustment > 0 ? '+' : '−' }}{{ formatMoney(Math.abs(orders.summary.adjustment)) }}</b>
                </div>
              </div>
              <div v-if="orders.summary.byCustomer?.length" class="who">
                <p class="who__h">แยกตามชื่อลูกค้า <small>{{ orders.summary.customerCount }} ราย · เรียงตามเงินรับซื้อ</small></p>
                <div class="who__scroll">
                  <table>
                    <thead><tr><th>ชื่อ</th><th class="r">ใบ</th><th class="r">น้ำหนัก (กก.)</th><th class="r">ราคาเฉลี่ย/กก.</th><th class="r">เงินรับซื้อ (บาท)</th></tr></thead>
                    <tbody>
                      <tr v-for="(c, i) in orders.summary.byCustomer" :key="i" :class="{ 'who--blank': c.type !== 'member' && !c.name }">
                        <td><b>{{ custLabel(c) }}</b><small v-if="c.type === 'member'">{{ c.memberNo }}</small><small v-else>{{ c.type === 'garden' ? 'สวน' : 'ลูกค้าทั่วไป' }}</small></td>
                        <td class="r">{{ c.bills }}</td>
                        <td class="r">{{ formatNumber(c.netKg) }}</td>
                        <td class="r">{{ formatNumber(c.avgPrice) }}</td>
                        <td class="r"><b>{{ formatMoney(c.amount) }}</b></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-if="orders.summary.customerCount > orders.summary.byCustomer.length" class="who__more">แสดง {{ orders.summary.byCustomer.length }} รายแรกจาก {{ orders.summary.customerCount }} ราย</p>
              </div>
            </div>
            <div class="sb__bar">
              <button type="button" class="sb__toggle" :aria-expanded="detailOpen" aria-controls="sum-detail" @click="pinned = !pinned">
                <span class="sb__chev" :class="{ up: detailOpen }" aria-hidden="true">▴</span> ยอดรวมตามตัวกรอง
              </button>
              <span class="sb__item">{{ orders.summary.bills }} <i>ใบ</i></span>
              <span class="sb__item">{{ formatNumber(orders.summary.netKg) }} <i>กก.</i></span>
              <span v-for="t in orders.summary.byProduct" :key="t.productType" class="sb__chip" :class="{ 'sb__chip--foam': t.productType === 'FOAM' }">{{ t.label }} <b>{{ formatMoney(t.amount) }}</b></span>
              <span class="sb__total"><small>ยอดเงินรวม</small> {{ formatMoney(orders.summary.total) }}</span>
            </div>
          </div>
        </template>
      </Pagination>
    </footer>

    <ReceiptModal v-model="receiptOpen" :order="receiptOrder" @printed="afterReceipt" @skip="afterReceipt" />

    <BaseModal v-model="payOpen" title="ต้องการจ่ายเงินหรือไม่ ?" width="400px">
      <p class="confirm">ใบรับซื้อ <b>#{{ receiptOrder?.no }}</b> ยืนยันเรียบร้อยแล้ว</p>
      <template #footer>
        <BaseButton variant="soft" @click="answerPay">ไม่ใช่</BaseButton>
        <BaseButton variant="success" @click="answerPay">ใช่</BaseButton>
      </template>
    </BaseModal>

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

.range { display: inline-flex; padding: 3px; gap: 2px; height: 36px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; }
.range__btn { padding: 0 12px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); transition: background .15s, color .15s; }
.range__btn:hover:not(.on):not(:disabled) { background: var(--slate-50); color: var(--slate-700); }
.range__btn.on { background: var(--blue-50); color: var(--blue-700); font-weight: 700; }
.range__btn:disabled { cursor: not-allowed; opacity: .6; }

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

.scroll { flex: 1; min-height: 0; overflow: auto; padding: 2px 2px 8px; }
.state { text-align: center; color: var(--slate-500); font-size: 13px; line-height: 1.8; padding: 64px 0; }
.state small { font-size: 12px; color: var(--slate-400); }
.sb { flex: none; }
.sb__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 4px 12px; min-height: 36px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); }
.sb__toggle { display: inline-flex; align-items: center; gap: 6px; margin-right: auto; font-size: 12px; font-weight: 800; color: var(--blue-700); }
.sb__chev { display: inline-block; font-size: 11px; transition: transform .15s; } .sb__chev.up { transform: rotate(180deg); }
.sb__item { font-size: 13px; font-weight: 700; color: var(--slate-800); font-variant-numeric: tabular-nums; } .sb__item i { font-style: normal; font-size: 11px; font-weight: 500; color: var(--slate-400); }
.sb__chip { padding: 2px 10px; border-radius: 9999px; background: #fff; border: 1px solid var(--blue-100); font-size: 11px; font-weight: 600; color: var(--blue-700); white-space: nowrap; font-variant-numeric: tabular-nums; } .sb__chip b { font-weight: 800; color: var(--slate-900); }
.sb__chip--foam { border-color: #fcd34d; color: var(--amber-700); }
.sb__total { font-size: 18px; font-weight: 800; letter-spacing: -.3px; color: var(--blue-700); font-variant-numeric: tabular-nums; } .sb__total small { font-size: 11px; font-weight: 600; letter-spacing: 0; color: var(--slate-500); margin-right: 4px; }
.sb__pop { position: absolute; left: 0; right: 0; bottom: calc(100% + 4px); z-index: 30; padding: 10px 12px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--blue-100); box-shadow: 0 12px 32px rgba(15, 23, 42, .16); }
.sb__ctx { margin-bottom: 8px; font-size: 11px; color: var(--slate-500); }
.sb__types { display: flex; flex-wrap: wrap; gap: 8px; }
.type { flex: 1 1 240px; display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 0 12px; padding: 8px 12px; border-radius: 10px; background: var(--slate-50); border: 1px solid var(--slate-100); border-left: 4px solid #2563eb; }
.type--foam { border-left-color: #d97706; } .type--adj { border-left-color: var(--slate-300); flex-grow: 0; } .type--zero { opacity: .55; }
.type__name { grid-row: span 2; display: flex; flex-direction: column; font-size: 13px; font-weight: 800; color: var(--slate-800); }
.type__name small { font-size: 11px; font-weight: 500; color: var(--slate-500); }
.type__kg { text-align: right; font-size: 12px; color: var(--slate-600); font-variant-numeric: tabular-nums; } .type__kg i { font-style: normal; font-size: 10px; color: var(--slate-400); }
.type__amt { text-align: right; font-size: 16px; font-weight: 800; color: var(--slate-900); font-variant-numeric: tabular-nums; }
.foot { position: relative; flex: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(226, 232, 240, .8); }
.confirm { font-size: 13px; line-height: 1.7; color: var(--slate-700); }
@media (max-width: 700px) {
  .orders { padding: 16px; }
  .head { flex-wrap: wrap; }
  h1 { font-size: 21px; }
}
.bk__txt { font-size: 13px; line-height: 1.7; color: var(--slate-600); margin-bottom: 12px; }
.bk__f { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--slate-800); }
.bk__f input { height: 38px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); font: inherit; font-size: 13px; }
.filter__grp { padding: 6px 10px 2px; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; color: var(--slate-400); }
.filter__grp:not(:first-child) { margin-top: 4px; border-top: 1px solid var(--slate-100); padding-top: 8px; }
.filter__menu { min-width: 250px; }
.who { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--slate-200); }
.who__h { margin-bottom: 6px; font-size: 12px; font-weight: 800; color: var(--slate-800); } .who__h small { font-weight: 500; color: var(--slate-500); margin-left: 6px; }
.who__scroll { max-height: 190px; overflow: auto; }
.who table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.who th { position: sticky; top: 0; background: #fff; text-align: left; font-size: 10.5px; font-weight: 700; color: var(--slate-500); padding: 3px 8px; }
.who td { padding: 5px 8px; border-top: 1px solid var(--slate-100); } .who td small { display: block; font-size: 10.5px; color: var(--slate-400); }
.who .r { text-align: right !important; white-space: nowrap; } .who--blank b { color: var(--slate-500); font-weight: 600; }
.who__more { margin-top: 4px; font-size: 11px; color: var(--slate-500); }
</style>

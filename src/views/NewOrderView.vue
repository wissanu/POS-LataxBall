<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ProductCard from '@/components/ProductCard.vue'
import OrderPanel from '@/components/OrderPanel.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import PriceBoardModal from '@/components/PriceBoardModal.vue'
import ContainerPickerModal from '@/components/ContainerPickerModal.vue'
import ContainerSettingsModal from '@/components/ContainerSettingsModal.vue'
import LumpImage from '@/components/LumpImage.vue'
import { usePriceBoardStore } from '@/stores/priceBoard'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/orders'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatThaiDate } from '@/utils/dates'

const board = usePriceBoardStore()
const auth = useAuthStore()
const cart = useCartStore()
const orders = useOrderStore()
const settings = useSettingsStore()
const toast = useToast()
const router = useRouter()

const canManage = computed(() => auth.can('price.manage')) // ตั้งราคา / sync / discard

const priceOpen = ref(false) // popup: ตั้ง/แก้ราคารับซื้อวันนี้ (ปุ่ม New)
const pickOpen = ref(false) // popup: เลือกภาชนะ (คลิกการ์ดสินค้า)
const settingsOpen = ref(false) // popup: ตั้งค่าน้ำหนักภาชนะ (ปุ่มฟันเฟือง)
const selected = ref(null)

onMounted(() => {
  board.start() // โหลดราคาวันนี้ + เฝ้าเที่ยงคืน (รีเซ็ตอัตโนมัติ)
  settings.load() // น้ำหนักภาชนะที่ตั้งไว้ (JSON)
})
onBeforeUnmount(() => board.stop())

// ---- เที่ยงคืน: ราคาเก่าใช้ไม่ได้แล้ว ล้างรายการที่ค้างอยู่ในตะกร้า ----
watch(() => board.dayChanges, () => {
  closeSelect()
  if (cart.lines.length) {
    cart.clear()
    toast.info('ขึ้นวันใหม่แล้ว ราคาถูกรีเซ็ต รายการที่ค้างในตะกร้าถูกล้าง')
  } else {
    toast.info('ขึ้นวันใหม่แล้ว ยังไม่มีข้อมูลของวันนี้')
  }
})
// ตะกร้าที่ค้างสินค้าซึ่งไม่อยู่ในราคาวันนี้ (ถูก discard / ไม่ใช่ของวันนี้) -> เอาออก
watch(() => board.items, (items) => {
  if (!board.loaded || !board.exists) return // no board at all = a new day: the midnight watcher above handles the cart
  const ids = new Set(items.map((i) => i.id))
  const stale = cart.lines.filter((l) => !ids.has(l.productId))
  if (stale.length) {
    stale.forEach((l) => cart.removeLine(l.uid))
    toast.info(`นำ ${stale.length} รายการที่ไม่มีในราคาวันนี้ออกจากตะกร้าแล้ว`)
  }
})
// ไม่แสดงข้อความ error ในพื้นที่รายการ — แจ้งด้วย toast ครั้งเดียวตอนมีปัญหา
watch(() => board.error, (m) => m && toast.error(m))

// ---- sync ข้อมูลเมื่อวาน ----
async function doSync() {
  try {
    await board.syncYesterday()
    toast.success(`sync ข้อมูลของ ${formatThaiDate(board.board?.copiedFrom || board.yesterday.date)} แล้ว`)
  } catch (e) {
    toast.error(getErrorMessage(e, 'sync ไม่สำเร็จ'))
    board.load({ silent: true })
  }
}

// ---- เลือกรายการเพื่อ discard ----
const selecting = ref(false)
const picked = ref(new Set())
const confirmOpen = ref(false)
const discarding = ref(false)
function startSelect() { picked.value = new Set(); selecting.value = true }
function closeSelect() { selecting.value = false; picked.value = new Set(); confirmOpen.value = false }
function toggleAll() {
  picked.value = picked.value.size === board.items.length ? new Set() : new Set(board.items.map((i) => i.id))
}
async function doDiscard() {
  discarding.value = true
  try {
    const n = picked.value.size
    await board.discard([...picked.value])
    toast.success(`discard ${n} รายการแล้ว`)
    closeSelect()
  } catch (e) {
    toast.error(getErrorMessage(e, 'discard ไม่สำเร็จ'))
  } finally {
    discarding.value = false
  }
}

function onCard(product) {
  if (selecting.value) {
    const next = new Set(picked.value)
    next.has(product.id) ? next.delete(product.id) : next.add(product.id)
    picked.value = next
    return
  }
  selected.value = product
  pickOpen.value = true
}
// each pick = a NEW line on the right (same product / same container can be added again and again)
function onPick(container) {
  cart.addLine(selected.value, container)
  toast.success(`เพิ่ม ${selected.value.name} (${container.short})`)
}
function openDrafts() {
  orders.statusFilter = 'draft'
  router.push({ name: 'orders' })
}
</script>

<template>
  <section class="center glass">
    <!-- ส่วนที่ 1 -->
    <header class="title">
      <div class="title__main">
        <div class="title__row">
          <h1>จัดทำรายการ</h1>
          <span class="live">Live</span>
        </div>
        <p class="crumbs">Dashboard <i>•</i> <b>New Order</b></p>
        <div class="quick">
          <BaseButton size="sm" :disabled="!canManage || undefined" :title="canManage ? undefined : 'ต้องมีสิทธิ์ตั้งราคา (ผู้จัดการ/ผู้ดูแลระบบ)'" @click="priceOpen = true"><AppIcon name="plus" :size="14" /> New</BaseButton>
          <BaseButton variant="outline" size="sm" @click="toast.info('ยังไม่เปิดใช้งานฟีเจอร์นี้')"><AppIcon name="qr" :size="14" /> QR Menu Orders</BaseButton>
          <BaseButton variant="outline" size="sm" @click="openDrafts"><AppIcon name="file" :size="14" /> Draft List</BaseButton>
          <BaseButton variant="outline" size="sm" @click="toast.info('ยังไม่เปิดใช้งานฟีเจอร์นี้')"><AppIcon name="table" :size="14" /> Table Order</BaseButton>
        </div>
      </div>
      <!-- ปุ่มฟันเฟือง: ตั้งค่าน้ำหนักภาชนะ (ตัวเลขที่ใช้หักในส่วนที่ 4) -->
      <button type="button" class="gear" title="ตั้งค่าน้ำหนักภาชนะ" aria-label="ตั้งค่าน้ำหนักภาชนะ" @click="settingsOpen = true"><AppIcon name="gear" :size="20" /></button>
    </header>

    <!-- แถบข้อมูลราคาของวันนี้ + เลือกเพื่อ discard (แสดงเมื่อมีข้อมูลของวันนี้แล้ว) -->
    <div v-if="board.exists" class="bar">
      <span class="bar__date">ราคารับซื้อ ประจำวันที่ <b>{{ formatThaiDate(board.date) }}</b></span>
      <span v-if="board.board?.copiedFrom" class="bar__sync"><AppIcon name="sync" :size="12" /> sync จาก {{ formatThaiDate(board.board.copiedFrom) }}</span>
      <span class="bar__grow" />
      <template v-if="canManage && board.items.length">
        <template v-if="!selecting">
          <BaseButton variant="outline" size="sm" @click="startSelect"><AppIcon name="check" :size="14" /> เลือกเพื่อ discard</BaseButton>
        </template>
        <template v-else>
          <span class="bar__count" aria-live="polite">เลือกแล้ว {{ picked.size }} / {{ board.items.length }}</span>
          <BaseButton variant="soft" size="sm" @click="toggleAll">{{ picked.size === board.items.length ? 'ล้างที่เลือก' : 'เลือกทั้งหมด' }}</BaseButton>
          <button type="button" class="danger" :disabled="!picked.size" @click="confirmOpen = true"><AppIcon name="trash" :size="14" /> Discard ({{ picked.size }})</button>
          <BaseButton variant="soft" size="sm" @click="closeSelect">ยกเลิก</BaseButton>
        </template>
      </template>
    </div>

    <!-- ส่วนที่ 3 -->
    <div class="grid scroll-y">
      <p v-if="!board.loaded" class="state">กำลังโหลดรายการ…</p>

      <!-- ยังไม่มีข้อมูลของวันนี้ (รวมถึงหลังเที่ยงคืน) -->
      <div v-else-if="!board.exists" class="empty">
        <span class="empty__img"><LumpImage /></span>
        <h2>ยังไม่มีข้อมูลของวันนี้</h2>
        <p class="empty__or">หรือ</p>
        <button type="button" class="syncbtn" :disabled="!canManage || !board.canSync || board.busy" @click="doSync">
          <AppIcon name="sync" :size="16" :class="{ spin: board.busy }" /> sync ข้อมูลเมื่อวาน
        </button>
        <small v-if="!canManage" class="empty__note">ต้องให้ผู้จัดการหรือผู้ดูแลระบบเป็นผู้ตั้งราคาประจำวัน</small>
        <small v-else-if="!board.yesterday.available" class="empty__note">ไม่มีข้อมูลของเมื่อวานให้ sync — กดปุ่ม New เพื่อตั้งราคาของวันนี้</small>
      </div>

      <!-- มีกลุ่มของวันนี้ แต่ถูก discard จนหมด -->
      <div v-else-if="!board.items.length" class="empty">
        <span class="empty__img"><LumpImage /></span>
        <h2>ไม่มีรายการเหลืออยู่</h2>
        <p class="empty__note">รายการของวันนี้ถูก discard ทั้งหมดแล้ว กดปุ่ม New เพื่อตั้งราคาใหม่</p>
      </div>

      <template v-else>
        <ProductCard v-for="p in board.products" :key="p.id" :product="p" :selectable="selecting" :selected="picked.has(p.id)" @select="onCard" />
      </template>
    </div>
  </section>

  <!-- ส่วนที่ 4 -->
  <OrderPanel />

  <PriceBoardModal v-model="priceOpen" />
  <ContainerSettingsModal v-model="settingsOpen" />
  <ContainerPickerModal v-model="pickOpen" :product="selected" @pick="onPick" />

  <BaseModal v-model="confirmOpen" title="Discard รายการที่เลือก" width="420px">
    <p class="confirm">ต้องการ discard <b>{{ picked.size }}</b> รายการออกจากราคาของวันนี้ใช่ไหม? รายการที่ discard จะไม่แสดงและใช้รับซื้อในวันนี้ไม่ได้ (กลับมาได้โดยกรอกราคาใหม่ด้วยปุ่ม New)</p>
    <template #footer>
      <BaseButton variant="soft" @click="confirmOpen = false">ยกเลิก</BaseButton>
      <BaseButton variant="dark" :loading="discarding" @click="doDiscard">Discard</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.center { flex: 1; min-width: 0; padding: 21px; display: flex; flex-direction: column; }
.title { padding-bottom: 17px; border-bottom: 1px solid rgba(226, 232, 240, .6); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.title__main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.gear { flex: none; width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; color: var(--slate-600); background: var(--glass-strong); border: 1px solid rgba(226, 232, 240, .9); box-shadow: 0 1px 2px rgba(0, 0, 0, .05); transition: color .15s, border-color .15s, transform .3s; }
.gear:hover { color: var(--blue-600); border-color: #93c5fd; transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) { .gear:hover { transform: none; } }
.title__row { display: flex; align-items: center; gap: 8px; }
h1 { font-size: 20px; font-weight: 700; letter-spacing: -.2px; color: var(--slate-900); line-height: 1.5; }
.live { background: var(--green-100); color: var(--green-700); font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; }
.crumbs { font-size: 12px; color: var(--slate-400); margin-top: -10px; }
.crumbs i { font-style: normal; margin: 0 4px; }
.crumbs b { color: var(--blue-600); font-weight: 500; }
.quick { display: flex; flex-wrap: wrap; gap: 8px; }

.grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 14px; align-content: start; padding: 16px 4px 16px 0; }
.state { grid-column: 1 / -1; text-align: center; color: var(--slate-500); font-size: 13px; padding: 48px 0; }
.state--error { color: #dc2626; }
.state button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 48px 16px; }
.empty__img { width: 150px; height: 112px; }
.empty h2 { font-size: 16px; font-weight: 700; line-height: 1.5; color: var(--slate-800); }
.empty p { max-width: 340px; font-size: 13px; line-height: 1.6; color: var(--slate-500); margin-bottom: 6px; }


.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 0 0; font-size: 12px; color: var(--slate-500); }
.bar b { color: var(--slate-800); font-weight: 600; }
.bar__sync { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 9999px; background: var(--blue-50); color: var(--blue-700); font-weight: 600; }
.bar__grow { flex: 1; }
.bar__count { font-weight: 600; color: var(--slate-700); }
.danger { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: var(--radius-md); background: #dc2626; color: #fff; font-size: 12px; font-weight: 600; }
.danger:hover:not(:disabled) { background: #b91c1c; }
.danger:disabled { opacity: .45; cursor: not-allowed; }
.confirm { font-size: 13px; line-height: 1.7; color: var(--slate-700); }

.empty__or { margin: 0; font-size: 13px; color: var(--slate-400); }
.empty__note { max-width: 360px; font-size: 12px; line-height: 1.6; color: var(--slate-500); }
.syncbtn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); color: var(--blue-700); font-size: 13px; font-weight: 600; transition: background .15s, border-color .15s; }
.syncbtn:hover:not(:disabled) { background: var(--blue-100); border-color: #93c5fd; }
.syncbtn:disabled { opacity: .5; cursor: not-allowed; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'
import { useCartStore } from '@/stores/cart'
import { useMemberStore } from '@/stores/members'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatMoney, formatNumber, formatKg, sanitizeDecimal, toNumber } from '@/utils/format'

const cart = useCartStore()
const members = useMemberStore()
const toast = useToast()

const collapsed = ref(false)
const search = ref('')
const busy = ref(false)

onMounted(() => members.load())

const badge = computed(() => (cart.customerType === 'member' ? cart.member?.no ?? '—' : null))
const subtitle = computed(() => {
  if (cart.customerType === 'general') return 'ลูกค้าทั่วไป (ไม่มีสมาชิก)'
  return cart.member ? `ลูกค้าประจำ · ${cart.member.no} ${cart.member.name}` : 'ยังไม่ได้เลือกหมายเลขลูกค้าประจำ'
})
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? cart.lines.filter((l) => l.name.toLowerCase().includes(q) || l.containerLabel.toLowerCase().includes(q)) : cart.lines
})

// number inputs: only digits + one dot, max 2 decimals; write the cleaned text back to the field
function onNum(e, uid, field) {
  const v = sanitizeDecimal(e.target.value)
  if (v !== e.target.value) e.target.value = v
  cart.setLine(uid, field, v)
}
function onDiscount(e) {
  const v = sanitizeDecimal(e.target.value)
  if (v !== e.target.value) e.target.value = v
  cart.discountValue = v
}
function setMode(mode) {
  if (cart.discountMode === mode) return
  cart.discountMode = mode
  cart.discountValue = '' // the unit changed, so the old number would be misleading
}

// after choosing a container in the popup, jump straight to the weight field of the new line
watch(() => cart.lastAddedUid, async (uid) => {
  if (!uid) return
  collapsed.value = false
  search.value = ''
  await nextTick()
  const el = document.getElementById(`gross-${uid}`)
  el?.scrollIntoView?.({ block: 'nearest' })
  el?.focus()
})

async function send(status, message) {
  if (!cart.lines.length || busy.value) return
  if (status !== 'draft') {
    if (cart.customerType === 'member' && !cart.member) return toast.error('กรุณาเลือกหมายเลขลูกค้าประจำ')
    if (cart.lines.some((l) => cart.netOf(l) <= 0)) return toast.error('กรุณาใส่น้ำหนักให้ครบทุกรายการ')
  }
  busy.value = true
  try {
    const order = await cart.submit(status)
    toast.success(`${message} · #${order.id}`)
  } catch (e) {
    toast.error(getErrorMessage(e, 'บันทึกรายการไม่สำเร็จ'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <aside class="panel glass" :class="{ 'panel--collapsed': collapsed }" aria-label="รายการปัจจุบัน">
    <header class="head">
      <div v-if="!collapsed" class="who">
        <span class="badge" :class="{ 'badge--member': badge }">
          <template v-if="badge">{{ badge }}</template>
          <AppIcon v-else name="user" :size="18" />
        </span>
        <div>
          <h2>รายการใหม่ <i class="dot" /></h2>
          <p>{{ subtitle }}</p>
        </div>
      </div>
      <button class="toggle" type="button" :aria-expanded="!collapsed" :aria-label="collapsed ? 'ขยายแผงรายการ' : 'ย่อแผงรายการ'" @click="collapsed = !collapsed">
        <AppIcon :name="collapsed ? 'chevron-left' : 'chevron-right'" />
      </button>
    </header>

    <template v-if="!collapsed">
      <!-- ลูกค้า: ประจำ (เลือกหมายเลข) หรือ ทั่วไป -->
      <section class="customer" aria-label="ลูกค้า">
        <div class="seg" role="radiogroup" aria-label="ประเภทลูกค้า">
          <button type="button" role="radio" :aria-checked="cart.customerType === 'member'" :class="{ on: cart.customerType === 'member' }" @click="cart.customerType = 'member'">ลูกค้าประจำ</button>
          <button type="button" role="radio" :aria-checked="cart.customerType === 'general'" :class="{ on: cart.customerType === 'general' }" @click="cart.customerType = 'general'">ลูกค้าทั่วไป</button>
        </div>
        <label v-if="cart.customerType === 'member'" class="select">
          <span class="sr-only">หมายเลขลูกค้าประจำ</span>
          <select v-model="cart.memberId">
            <option :value="null" disabled>เลือกหมายเลขลูกค้าประจำ</option>
            <option v-for="m in members.items" :key="m.id" :value="m.id">{{ m.no }} · {{ m.name }}</option>
          </select>
          <AppIcon name="chevron-down" :size="14" />
        </label>
        <p v-if="members.error && cart.customerType === 'member'" class="err">{{ members.error }} <button type="button" @click="members.load(true)">ลองใหม่</button></p>
      </section>

      <div class="list-head">
        <h3>รายการสินค้า <span>{{ cart.lines.length }}</span></h3>
        <label v-if="cart.lines.length > 2" class="mini-search">
          <AppIcon name="search" :size="12" />
          <input v-model="search" placeholder="ค้นหา" aria-label="ค้นหาในรายการ" />
        </label>
        <button v-if="cart.lines.length" type="button" class="clear" @click="cart.clear()">ล้างทั้งหมด</button>
      </div>

      <ul class="items scroll-y">
        <li v-if="!shown.length" class="empty">
          {{ cart.lines.length ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ กดเลือกสินค้าด้านซ้ายเพื่อเพิ่ม' }}
        </li>

        <li v-for="line in shown" :key="line.uid" class="item">
          <div class="item__top">
            <div>
              <h4>{{ line.name }}</h4>
              <p class="meta"><span class="chip">{{ line.containerLabel }}</span> {{ formatNumber(line.pricePerKg) }} บาท/กก.</p>
            </div>
            <button type="button" class="icon-btn" :aria-label="`ลบ ${line.name}`" @click="cart.removeLine(line.uid)"><AppIcon name="trash" :size="14" /></button>
          </div>

          <div class="weights">
            <label class="wfield">
              <span>น้ำหนักรวม</span>
              <span class="wbox">
                <input :id="`gross-${line.uid}`" :value="line.gross" inputmode="decimal" placeholder="0.00" maxlength="9" autocomplete="off" @input="onNum($event, line.uid, 'gross')" />
                <em>กก.</em>
              </span>
            </label>
            <label class="wfield">
              <span>หักภาชนะ</span>
              <span class="wbox">
                <input :value="line.tare" inputmode="decimal" placeholder="0.00" maxlength="9" autocomplete="off" @input="onNum($event, line.uid, 'tare')" />
                <em>กก.</em>
              </span>
            </label>
          </div>

          <div class="item__foot">
            <span>สุทธิ <b>{{ formatKg(cart.netOf(line)) }}</b></span>
            <strong>{{ formatMoney(cart.amountOf(line)) }}</strong>
          </div>
        </li>
      </ul>

      <!-- ส่วนลด -->
      <section class="discount" aria-label="ส่วนลด">
        <div class="discount__row">
          <span class="discount__title">ส่วนลด</span>
          <div class="seg seg--sm" role="radiogroup" aria-label="รูปแบบส่วนลด">
            <button type="button" role="radio" :aria-checked="cart.discountMode === 'perKg'" :class="{ on: cart.discountMode === 'perKg' }" @click="setMode('perKg')">ลดต่อ กก.</button>
            <button type="button" role="radio" :aria-checked="cart.discountMode === 'amount'" :class="{ on: cart.discountMode === 'amount' }" @click="setMode('amount')">ลดเป็นเงิน</button>
          </div>
        </div>
        <label class="wbox wbox--wide">
          <span class="sr-only">{{ cart.discountMode === 'perKg' ? 'ลดราคาต่อกิโลกรัม (บาท)' : 'จำนวนเงินที่ลด (บาท)' }}</span>
          <input :value="cart.discountValue" inputmode="decimal" placeholder="0.00" maxlength="9" autocomplete="off" @input="onDiscount" />
          <em>{{ cart.discountMode === 'perKg' ? 'บาท/กก.' : 'บาท' }}</em>
        </label>
        <p v-if="toNumber(cart.discountValue) > 0" class="hint" :class="{ 'hint--warn': cart.discountClamped }">
          <template v-if="cart.discountClamped">ส่วนลดเกินยอดรวม ระบบหักสูงสุดเท่ายอดรวม ({{ formatMoney(cart.discountAmount) }})</template>
          <template v-else-if="cart.discountMode === 'perKg'">ลด {{ formatNumber(toNumber(cart.discountValue)) }} บาท × {{ formatKg(cart.totalNet) }} = {{ formatMoney(cart.discountAmount) }}</template>
          <template v-else>หักออกจากยอดรวม {{ formatMoney(cart.discountAmount) }}</template>
        </p>
      </section>

      <dl class="summary">
        <div><dt>น้ำหนักสุทธิรวม</dt><dd>{{ formatKg(cart.totalNet) }}</dd></div>
        <div><dt>ยอดรวม</dt><dd>{{ formatMoney(cart.subtotal) }}</dd></div>
        <div><dt>ส่วนลด</dt><dd :class="{ minus: cart.discountAmount > 0 }">{{ cart.discountAmount > 0 ? '−' : '' }}{{ formatMoney(cart.discountAmount) }}</dd></div>
        <div class="total"><dt>ยอดสุทธิ</dt><dd>{{ formatMoney(cart.total) }}</dd></div>
      </dl>

      <div class="actions">
        <BaseButton variant="dark" size="sm" :loading="busy" :disabled="!cart.lines.length" @click="send('pending', 'ส่งรายการแล้ว')">KOT &amp; Print</BaseButton>
        <BaseButton variant="soft" size="sm" :disabled="!cart.lines.length" @click="send('draft', 'บันทึกฉบับร่างแล้ว')"><AppIcon name="file" :size="14" /> Draft</BaseButton>
        <BaseButton variant="primary" :disabled="!cart.lines.length" @click="send('pending', 'พร้อมชำระเงิน')"><AppIcon name="wallet" /> Bill &amp; Payment</BaseButton>
        <BaseButton variant="success" :disabled="!cart.lines.length" @click="send('pending', 'พิมพ์บิลแล้ว')"><AppIcon name="printer" /> Bill &amp; Print</BaseButton>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.panel { width: 384px; flex: none; padding: 17px; display: flex; flex-direction: column; background: var(--glass-strong); transition: width .2s; min-height: 0; }
.panel--collapsed { width: 62px; padding: 17px 12px; }
.head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 13px; border-bottom: 1px solid rgba(226, 232, 240, .6); }
.panel--collapsed .head { border: 0; justify-content: center; }
.who { display: flex; gap: 10px; align-items: center; min-width: 0; }
.badge { width: 36px; height: 36px; flex: none; border-radius: var(--radius-md); background: var(--slate-100); color: var(--slate-500); display: grid; place-items: center; font-weight: 700; font-size: 12px; }
.badge--member { background: var(--blue-100); color: var(--blue-700); }
h2 { font-size: 13px; font-weight: 700; color: var(--slate-900); display: flex; align-items: center; gap: 6px; line-height: 1.5; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; }
.who p { font-size: 11px; line-height: 1.5; color: var(--slate-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.toggle { flex: none; width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--slate-100); display: grid; place-items: center; color: var(--slate-600); }

/* customer */
.customer { display: flex; flex-direction: column; gap: 8px; padding: 12px 0 8px; }
.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--slate-100); border-radius: var(--radius-md); }
.seg button { padding: 7px 8px; border-radius: 9px; font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--slate-500); transition: background .15s, color .15s; }
.seg button.on { background: #fff; color: var(--blue-700); box-shadow: 0 1px 3px rgba(15, 23, 42, .12); }
.seg--sm { padding: 3px; }
.seg--sm button { padding: 4px 10px; font-size: 11px; white-space: nowrap; }
.select { position: relative; display: flex; align-items: center; height: 36px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); color: var(--slate-400); }
.select select { appearance: none; width: 100%; height: 100%; border: 0; background: none; outline: none; padding: 0 30px 0 12px; font-size: 12px; font-weight: 500; color: var(--slate-800); cursor: pointer; }
.select:focus-within { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.select svg { position: absolute; right: 10px; pointer-events: none; }
.err { font-size: 11px; color: #dc2626; }
.err button { color: var(--blue-600); font-weight: 600; margin-left: 6px; }

/* list */
.list-head { display: flex; align-items: center; gap: 8px; padding: 6px 0 8px; }
.list-head h3 { font-size: 12px; font-weight: 700; color: var(--slate-700); line-height: 1.5; margin-right: auto; }
.list-head h3 span { display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 4px; border-radius: 9px; background: var(--blue-100); color: var(--blue-700); font-size: 11px; text-align: center; }
.mini-search { display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; background: #fff; border: 1px solid var(--slate-200); border-radius: 8px; color: var(--slate-400); width: 92px; }
.mini-search input { width: 100%; min-width: 0; border: 0; outline: none; background: none; font-size: 11px; color: var(--slate-800); }
.clear { font-size: 11px; font-weight: 600; color: var(--slate-500); }
.clear:hover { color: #dc2626; }

.items { flex: 1; min-height: 120px; list-style: none; margin: 0; padding: 2px 4px 4px 0; display: flex; flex-direction: column; gap: 8px; }
.empty { text-align: center; color: var(--slate-400); font-size: 12px; line-height: 1.6; padding: 28px 12px; }
.item { background: rgba(248, 250, 252, .8); border: 1px solid var(--slate-100); border-radius: var(--radius-md); padding: 11px; display: flex; flex-direction: column; gap: 9px; }
.item__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.item h4 { font-size: 13px; font-weight: 700; line-height: 1.5; color: var(--slate-800); overflow-wrap: anywhere; }
.meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 11px; line-height: 1.5; color: var(--slate-500); }
.chip { background: var(--blue-50); color: var(--blue-700); font-weight: 600; padding: 1px 8px; border-radius: 6px; }
.icon-btn { padding: 4px; color: var(--slate-400); border-radius: 6px; flex: none; }
.icon-btn:hover { color: #dc2626; background: var(--red-50); }

.weights { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.wfield { display: flex; flex-direction: column; gap: 3px; }
.wfield > span:first-child { font-size: 10px; font-weight: 600; line-height: 1.4; color: var(--slate-500); }
.wbox { position: relative; display: flex; align-items: center; }
.wbox input { width: 100%; height: 34px; padding: 0 34px 0 10px; text-align: right; font-size: 13px; font-weight: 700; color: var(--slate-900); background: #fff; border: 1px solid var(--slate-200); border-radius: 10px; outline: none; }
.wbox input:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.wbox input::placeholder { color: var(--slate-300); font-weight: 500; }
.wbox em { position: absolute; right: 9px; font-style: normal; font-size: 11px; color: var(--slate-400); pointer-events: none; }
.wbox--wide em { right: 11px; }
.item__foot { display: flex; justify-content: space-between; align-items: baseline; padding-top: 8px; border-top: 1px dashed var(--slate-200); font-size: 12px; color: var(--slate-500); }
.item__foot b { color: var(--slate-800); }
.item__foot strong { font-size: 15px; color: var(--blue-600); }

/* discount + summary */
.discount { display: flex; flex-direction: column; gap: 6px; padding: 10px 0 6px; border-top: 1px solid rgba(226, 232, 240, .8); }
.discount__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.discount__title { font-size: 12px; font-weight: 700; color: var(--slate-700); }
.hint { font-size: 11px; line-height: 1.5; color: var(--slate-500); }
.hint--warn { color: var(--amber-700); }
.summary { margin: 0; padding-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.summary div { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; line-height: 1.6; }
.summary dt { color: var(--slate-500); }
.summary dd { margin: 0; font-weight: 600; color: var(--slate-800); }
.summary .minus { color: #dc2626; }
.summary .total { border-top: 1px dashed var(--slate-200); padding-top: 6px; margin-top: 2px; }
.summary .total dt { font-size: 14px; font-weight: 700; color: var(--slate-900); }
.summary .total dd { font-size: 20px; font-weight: 700; color: var(--blue-600); }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 12px; }
</style>

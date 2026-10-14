<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'
import AdditionModal from './AdditionModal.vue'
import { useCartStore } from '@/stores/cart'
import { useMemberStore } from '@/stores/members'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatMoney, formatNumber, formatKg, sanitizeDecimal, toNumber } from '@/utils/format'

/**
 * แผงรายการปัจจุบัน (ขวา) — แสดงผลเป็นข้อความทั้งหมด
 *   ลูกค้า (เลือกที่หน้าต่างเกรด) · ตารางรายการ · เพิ่มราคา · สรุปยอด · ปุ่ม Draft / Bill & Print
 *   กรอก/ลบแถว: กดการ์ดเกรดในหน้า New Order (หน้าต่างเกรดจะแสดงแถวเดิมให้แก้ไข)
 *   แก้น้ำหนักสินค้าเร็วๆ: ปุ่ม "แก้ไข" ข้าง "ล้างทั้งหมด" → ช่องน้ำหนักทุกแถวกลายเป็นช่องกรอก · กด Enter หรือกดปุ่มอีกครั้ง ("ยืนยัน") = บันทึกและคำนวณยอดใหม่ · Esc = ยกเลิก
 *   ย่อแผง: ซ่อนแผงทั้งหมด เหลือปุ่มลอย (ไอคอนรายการ) ที่ขอบขวา — กดอีกครั้งเพื่อเปิดกลับ
 */
const cart = useCartStore()
const members = useMemberStore()
const toast = useToast()

const collapsed = ref(false)
const busy = ref(false)
const additionOpen = ref(false)
const editingAddition = ref(null)

// ---- แก้น้ำหนักสินค้าในแผง (ทุกแถวพร้อมกัน) ----
const editing = ref(false)
const drafts = reactive({}) // uid -> น้ำหนักที่กำลังพิมพ์ (ยังไม่เข้าตะกร้าจนกว่าจะยืนยัน)
function startEdit() {
  if (!cart.lines.length) return
  for (const k of Object.keys(drafts)) delete drafts[k]
  cart.lines.forEach((l) => { drafts[l.uid] = String(l.gross ?? '') })
  editing.value = true
  nextTick(() => document.getElementById(`pw-${cart.lines[0].uid}`)?.select())
}
function commitEdit() {
  const i = cart.lines.findIndex((l) => toNumber(drafts[l.uid]) <= cart.tareOf(l))
  if (i >= 0) {
    toast.error(`ลำดับ ${i + 1}: น้ำหนักสินค้าต้องมากกว่าน้ำหนักภาชนะ (${formatKg(cart.tareOf(cart.lines[i]))})`)
    document.getElementById(`pw-${cart.lines[i].uid}`)?.focus()
    return
  }
  cart.lines.forEach((l) => { if (String(drafts[l.uid]) !== String(l.gross)) cart.setGross(l.uid, String(drafts[l.uid])) }) // ยอดรวมทั้งหมดคำนวณใหม่จาก store เอง
  editing.value = false
}
const cancelEdit = () => { editing.value = false }
const toggleEdit = () => (editing.value ? commitEdit() : startEdit())
function onDraft(e, uid) {
  const v = sanitizeDecimal(e.target.value)
  if (v !== e.target.value) e.target.value = v
  drafts[uid] = v
}
watch(() => cart.lines.length, (n) => { if (!n) editing.value = false })

onMounted(() => members.load())

const badge = computed(() => (cart.customerType === 'member' ? cart.member?.no ?? '—' : null))
const customerText = computed(() => {
  if (cart.customerType === 'general') return { tag: 'ลูกค้าทั่วไป', name: '', ok: true }
  return cart.member
    ? { tag: 'ลูกค้าประจำ', name: `${cart.member.no} ${cart.member.name}`, ok: true }
    : { tag: 'ลูกค้าประจำ', name: 'ยังไม่ได้เลือกลูกค้า', ok: false }
})

// ตาราง: แถวของเกรด+ภาชนะเดียวกันอยู่ติดกัน (cart.setGroup รับประกัน) — แทรกหัวกลุ่มเมื่อเปลี่ยนเกรด/ภาชนะ
const table = computed(() => {
  const out = []
  let prev = ''
  cart.lines.forEach((l, i) => {
    const key = `${l.productId}|${l.containerId}`
    if (key !== prev) { out.push({ head: true, key: `h-${key}-${i}`, text: `${l.name} · ${l.containerLabel}` }); prev = key }
    out.push({ head: false, key: l.uid, no: i + 1, l })
  })
  return out
})
const lineNo = (uid) => cart.lines.findIndex((l) => l.uid === uid) + 1

function addAddition() { editingAddition.value = null; additionOpen.value = true }
function editAddition(id) { editingAddition.value = id; additionOpen.value = true }
const scopeLabel = (r) => (r.scope === 'all' ? 'ทุกตะกร้า' : `ลำดับ ${lineNo(r.scope)} ${r.line?.name ?? ''}`)
const modeLabel = (r) => (r.mode === 'perKg' ? `เพิ่ม ${formatNumber(toNumber(r.value))} บาท/กก.` : 'เพิ่มเป็นเงิน')

async function send(status, message) {
  if (!cart.lines.length || busy.value) return
  if (status !== 'draft') {
    if (cart.customerType === 'member' && !cart.member) return toast.error('กรุณาเลือกลูกค้าประจำ (เลือกได้ที่หน้าต่างเกรด)')
    if (cart.lines.some((l) => cart.netOf(l) <= 0)) return toast.error('น้ำหนักสินค้าต้องมากกว่าน้ำหนักภาชนะทุกแถว')
  }
  busy.value = true
  try {
    const order = await cart.submit(status)
    toast.success(`${message} · #${order.no}`)
  } catch (e) {
    toast.error(getErrorMessage(e, 'บันทึกรายการไม่สำเร็จ'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <aside v-if="!collapsed" class="panel glass" aria-label="รายการปัจจุบัน">
    <header class="head">
      <div class="who">
        <span class="badge" :class="{ 'badge--member': badge }">
          <template v-if="badge">{{ badge }}</template>
          <AppIcon v-else name="user" :size="18" />
        </span>
        <div>
          <h2>รายการใหม่ <i class="dot" /></h2>
          <p>{{ cart.lines.length ? `${cart.lines.length} แถว · น้ำหนักสุทธิ ${formatKg(cart.totalNet)}` : 'ยังไม่มีรายการ' }}</p>
        </div>
      </div>
      <button class="toggle" type="button" aria-expanded="true" aria-label="ซ่อนแผงรายการ" title="ซ่อนแผงรายการ" @click="collapsed = true">
        <AppIcon name="chevron-right" />
      </button>
    </header>

      <!-- ลูกค้า: ข้อความอย่างเดียว (เลือกที่หน้าต่างเกรด) -->
      <section class="customer" aria-label="ลูกค้า">
        <span class="customer__tag">{{ customerText.tag }}</span>
        <b v-if="customerText.name" :class="{ 'customer__name--warn': !customerText.ok }">{{ customerText.name }}</b>
      </section>

      <div class="list-head">
        <h3>รายการสินค้า <span>{{ cart.lines.length }}</span></h3>
        <button v-if="cart.lines.length" type="button" class="edit" :class="{ on: editing }" :aria-pressed="editing" :title="editing ? 'ยืนยันการแก้ไข (Enter)' : 'แก้ไขน้ำหนักสินค้า'" @click="toggleEdit">
          <AppIcon :name="editing ? 'check' : 'edit'" :size="13" /> {{ editing ? 'ยืนยัน' : 'แก้ไข' }}
        </button>
        <button v-if="cart.lines.length" type="button" class="clear" :disabled="editing" @click="cart.clear()">ล้างทั้งหมด</button>
      </div>

      <div class="tbl scroll-y">
        <p v-if="!cart.lines.length" class="empty">ยังไม่มีรายการ กดเลือกเกรดด้านซ้ายเพื่อกรอกน้ำหนัก</p>
        <table v-else>
          <thead>
            <tr><th>ลำดับ</th><th>น้ำหนักภาชนะ</th><th>น้ำหนักสินค้า</th><th>ราคาต่อ กก.</th><th>ยอดรวม</th></tr>
          </thead>
          <tbody>
            <template v-for="row in table" :key="row.key">
              <tr v-if="row.head" class="grp"><th colspan="5" scope="colgroup">{{ row.text }}</th></tr>
              <tr v-else>
                <td class="c">{{ row.no }}</td>
                <td>{{ formatNumber(cart.tareOf(row.l)) }}</td>
                <td :class="{ 'is-edit': editing }">
                  <input
                    v-if="editing" :id="`pw-${row.l.uid}`" class="winput" :value="drafts[row.l.uid]" inputmode="decimal" maxlength="9" autocomplete="off"
                    :aria-label="`น้ำหนักสินค้า ลำดับ ${row.no}`" @input="onDraft($event, row.l.uid)" @keydown.enter.prevent="commitEdit" @keydown.esc.prevent="cancelEdit"
                  />
                  <template v-else>{{ formatNumber(toNumber(row.l.gross)) }}</template>
                </td>
                <td>{{ formatNumber(row.l.pricePerKg) }}</td>
                <td class="amt">
                  {{ formatNumber(cart.amountOf(row.l)) }}
                  <small v-if="cart.lineAdditionOf(row.l.uid) > 0">+{{ formatNumber(cart.lineAdditionOf(row.l.uid)) }}</small>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- เพิ่มราคา: หลายรายการต่อลูกค้า 1 คน (ร้านรับซื้อ = จ่ายลูกค้าเพิ่ม) -->
      <section class="add" aria-label="เพิ่มราคา">
        <div class="add__head">
          <h3><AppIcon name="tag" :size="14" /> เพิ่มราคา <span v-if="cart.additions.length">{{ cart.additions.length }}</span></h3>
          <button type="button" class="add__btn" :disabled="!cart.lines.length" @click="addAddition"><AppIcon name="plus" :size="13" /> เพิ่มราคา</button>
        </div>
        <ul v-if="cart.additionRows.length" class="add__list scroll-y">
          <li v-for="r in cart.additionRows" :key="r.id" class="arow">
            <button type="button" class="arow__main" :aria-label="`แก้ไขเพิ่มราคา ${scopeLabel(r)} ${modeLabel(r)}`" @click="editAddition(r.id)">
              <span class="arow__scope" :class="{ 'arow__scope--all': r.scope === 'all' }">{{ scopeLabel(r) }}</span>
              <span class="arow__text">{{ modeLabel(r) }}</span>
              <span class="arow__amt">+{{ formatMoney(r.amount) }}</span>
            </button>
            <button type="button" class="arow__del" :aria-label="`ลบเพิ่มราคา ${scopeLabel(r)}`" @click="cart.removeAddition(r.id)"><AppIcon name="x" :size="13" /></button>
          </li>
        </ul>
      </section>

      <dl class="summary">
        <div><dt>น้ำหนักสุทธิรวม</dt><dd>{{ formatKg(cart.totalNet) }}</dd></div>
        <div><dt>ยอดรวม</dt><dd>{{ formatMoney(cart.subtotal) }}</dd></div>
        <div><dt>เพิ่มราคา</dt><dd :class="{ plus: cart.additionAmount > 0 }">{{ cart.additionAmount > 0 ? '+' : '' }}{{ formatMoney(cart.additionAmount) }}</dd></div>
        <div class="total"><dt>ยอดสุทธิ</dt><dd>{{ formatMoney(cart.total) }}</dd></div>
      </dl>

      <div class="actions">
        <BaseButton variant="soft" :disabled="!cart.lines.length || editing" @click="send('draft', 'บันทึกฉบับร่างแล้ว')"><AppIcon name="file" :size="14" /> Draft</BaseButton>
        <BaseButton variant="success" :loading="busy" :disabled="!cart.lines.length || editing || busy" @click="send('pending', 'พิมพ์บิลแล้ว')"><AppIcon name="printer" /> Bill &amp; Print</BaseButton>
      </div>

    <AdditionModal v-model="additionOpen" :edit-id="editingAddition" />
  </aside>

  <!-- ย่อแผง: ปุ่มลอยติดขอบขวา (fixed) ไอคอนรายการ + จำนวนแถว — กดเพื่อเปิดแผงกลับ -->
  <Teleport to="body">
    <button v-if="collapsed" type="button" class="fab" aria-label="แสดงแผงรายการ" title="แสดงรายการ" @click="collapsed = false">
      <AppIcon name="list" :size="22" />
      <i v-if="cart.lines.length" class="fab__n">{{ cart.lines.length }}</i>
    </button>
  </Teleport>
</template>

<style scoped>
.panel { width: 384px; flex: none; padding: 17px; display: flex; flex-direction: column; background: var(--glass-strong); min-height: 0; }
.head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 13px; border-bottom: 1px solid rgba(226, 232, 240, .6); }
.who { display: flex; gap: 10px; align-items: center; min-width: 0; }
.badge { width: 36px; height: 36px; flex: none; border-radius: var(--radius-md); background: var(--slate-100); color: var(--slate-500); display: grid; place-items: center; font-weight: 700; font-size: 12px; }
.badge--member { background: var(--blue-100); color: var(--blue-700); }
h2 { font-size: 13px; font-weight: 700; color: var(--slate-900); display: flex; align-items: center; gap: 6px; line-height: 1.5; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; }
.who p { font-size: 11px; line-height: 1.5; color: var(--slate-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.toggle { flex: none; width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--slate-100); display: grid; place-items: center; color: var(--slate-600); }

.customer { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin: 12px 0 4px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--slate-50); border: 1px solid var(--slate-100); font-size: 13px; line-height: 1.5; }
.customer__tag { font-size: 11px; font-weight: 700; padding: 1px 9px; border-radius: 9999px; background: var(--blue-100); color: var(--blue-700); }
.customer b { color: var(--slate-900); overflow-wrap: anywhere; }
.customer__name--warn { color: var(--amber-700) !important; font-weight: 600; }

.list-head { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
.list-head h3 { font-size: 12px; font-weight: 700; color: var(--slate-700); line-height: 1.5; margin-right: auto; }
.list-head h3 span, .add__head h3 span { display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 4px; border-radius: 9px; background: var(--blue-100); color: var(--blue-700); font-size: 11px; text-align: center; }
.clear { font-size: 11px; font-weight: 600; color: var(--slate-500); }
.clear:hover:not(:disabled) { color: #dc2626; }
.clear:disabled { opacity: .4; cursor: not-allowed; }
.edit { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: var(--blue-700); background: var(--blue-50); border: 1px solid var(--blue-100); transition: background .15s, color .15s; }
.edit:hover { background: var(--blue-100); }
.edit.on { background: #dcfce7; border-color: #86efac; color: #15803d; }
.winput { width: 100%; min-width: 0; height: 28px; padding: 0 6px; text-align: right; font: inherit; font-weight: 700; color: var(--slate-900); background: #fff; border: 1px solid var(--slate-300); border-radius: 8px; outline: none; font-variant-numeric: tabular-nums; }
.winput:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.fab { position: fixed; right: 22px; top: 50%; transform: translateY(-50%); z-index: 30; width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: #fff; background: var(--blue-600); box-shadow: 0 8px 20px rgba(37, 99, 235, .35); transition: filter .15s, transform .15s; }
.fab:hover { filter: brightness(1.08); }
.fab:active { transform: translateY(-50%) scale(.96); }
.fab__n { position: absolute; top: -6px; left: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; display: grid; place-items: center; font-style: normal; font-size: 11px; font-weight: 700; color: var(--blue-700); background: #fff; border: 1px solid var(--blue-100); box-shadow: 0 1px 3px rgba(15, 23, 42, .2); }

.tbl { flex: 1; min-height: 120px; padding-right: 2px; }
.empty { text-align: center; color: var(--slate-400); font-size: 12px; line-height: 1.6; padding: 28px 12px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
thead th { position: sticky; top: 0; z-index: 1; padding: 7px 4px; background: var(--slate-100); color: var(--slate-600); font-size: 10.5px; font-weight: 700; line-height: 1.3; text-align: right; }
thead th:first-child { text-align: center; border-radius: 8px 0 0 8px; }
thead th:last-child { border-radius: 0 8px 8px 0; }
tbody td { padding: 7px 4px; text-align: right; color: var(--slate-800); font-weight: 600; border-bottom: 1px solid var(--slate-100); }
tbody td.c { text-align: center; color: var(--slate-500); }
.grp th { padding: 9px 4px 3px; text-align: left; font-size: 11.5px; font-weight: 700; color: var(--blue-700); background: none; position: static; }
.amt { color: var(--blue-600) !important; font-weight: 700 !important; }
.amt small { display: block; font-size: 10px; font-weight: 600; color: #15803d; }

.add { padding: 10px 0 4px; border-top: 1px solid rgba(226, 232, 240, .8); }
.add__head { display: flex; align-items: center; justify-content: space-between; }
.add__head h3 { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; line-height: 1.5; color: var(--slate-700); }
.add__btn { display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 9px; font-size: 11px; font-weight: 700; color: var(--blue-700); background: var(--blue-50); border: 1px solid var(--blue-100); transition: background .15s; }
.add__btn:hover:not(:disabled) { background: var(--blue-100); }
.add__btn:disabled { opacity: .5; cursor: not-allowed; }
.add__list { list-style: none; margin: 8px 0 0; padding: 0 2px 0 0; max-height: 108px; display: flex; flex-direction: column; gap: 5px; }
.arow { display: flex; align-items: stretch; background: #fff; border: 1px solid var(--slate-100); border-radius: 10px; overflow: hidden; }
.arow:hover { border-color: #bfdbfe; }
.arow__main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 7px 4px 7px 10px; text-align: left; font-size: 12px; line-height: 1.5; }
.arow__scope { flex: none; max-width: 46%; overflow: hidden; text-overflow: ellipsis; padding: 0 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: var(--blue-100); color: var(--blue-700); white-space: nowrap; }
.arow__scope--all { background: var(--slate-100); color: var(--slate-600); }
.arow__text { flex: 1; min-width: 0; color: var(--slate-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arow__amt { flex: none; font-weight: 700; color: #15803d; }
.arow__del { flex: none; width: 28px; display: grid; place-items: center; color: var(--slate-400); }
.arow__del:hover { background: var(--red-50); color: #dc2626; }

.summary { margin: 0; padding-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.summary div { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; line-height: 1.6; }
.summary dt { color: var(--slate-500); }
.summary dd { margin: 0; font-weight: 600; color: var(--slate-800); }
.summary .plus { color: #15803d; }
.summary .total { border-top: 1px dashed var(--slate-200); padding-top: 6px; margin-top: 2px; }
.summary .total dt { font-size: 14px; font-weight: 700; color: var(--slate-900); }
.summary .total dd { font-size: 20px; font-weight: 700; color: var(--blue-600); }
.actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; padding-top: 12px; }
</style>

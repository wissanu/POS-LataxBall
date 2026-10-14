<script setup>
import { reactive, ref, computed, watch, nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import AppIcon from './AppIcon.vue'
import LumpImage from './LumpImage.vue'
import MemberCombobox from './MemberCombobox.vue'
import { useCartStore } from '@/stores/cart'
import { useMemberStore } from '@/stores/members'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { formatMoney, formatNumber, formatKg, sanitizeDecimal, toNumber, round2 } from '@/utils/format'

/**
 * หน้าต่างกรอกรายการของเกรดที่เลือก (เปิดจากการ์ดเกรดในหน้า New Order)
 *   ① ลูกค้า        : ประจำ (ค้นหาชื่อ/รหัส) หรือ ทั่วไป — เลือกที่นี่ได้เลย (แผงขวาแสดงเป็นข้อความ)
 *   ② ภาชนะ        : toggle "ไม่ใส่ตะกร้าเข่ง" / "ตะกร้าเข่ง"  (แต่ละแบบมีตารางของตัวเอง)
 *   ③ ตารางน้ำหนัก  : ลำดับ · น้ำหนักภาชนะ · น้ำหนักสินค้า · ราคาต่อ กก. · ยอดรวม · แก้ไข · ลบ
 *        - เริ่มต้น 1 แถว · เพิ่มแถวถัดไปได้เมื่อแถวก่อนหน้ากรอกครบทุกคอลัมน์เท่านั้น: กด Tab (ที่ช่องน้ำหนักของแถวสุดท้าย) หรือปุ่ม +
 *        - น้ำหนักสินค้า = น้ำหนักที่ชั่งได้ (รวมภาชนะ) · ระบบหักน้ำหนักภาชนะให้เอง → ยอดรวม = (น้ำหนักสินค้า − น้ำหนักภาชนะ) × ราคา
 *   กด "บันทึกลงรายการ" แล้วแถวทั้งหมดจะเข้าแผงรายการด้านขวา · เปิดเกรดเดิมอีกครั้งจะเห็นแถวเดิมและแก้ไข/ลบได้
 */
const props = defineProps({ modelValue: Boolean, product: Object })
const emit = defineEmits(['update:modelValue'])

const cart = useCartStore()
const members = useMemberStore()
const settings = useSettingsStore()
const toast = useToast()

const MODES = [
  { id: 'none', label: 'ไม่ใส่ตะกร้าเข่ง' },
  { id: 'keng', label: 'ตะกร้าเข่ง' },
]
const COLS = ['ลำดับ', 'น้ำหนักภาชนะ', 'น้ำหนักสินค้า', 'ราคาต่อ กก.', 'ยอดรวม', 'แก้ไข', 'ลบ']

let keySeq = 0
const newRow = () => ({ key: ++keySeq, uid: null, gross: '', editing: true })
const mode = ref('none')
const rows = reactive({ none: [], keng: [] }) // { key, uid|null (บรรทัดเดิมในตะกร้า), gross: string, editing }
const error = ref('')
const askDiscard = ref(false)
let initial = ''

const price = computed(() => Number(props.product?.price) || 0)
const tareOf = (m) => settings.tareOf(m)
const netOf = (m, r) => Math.max(0, round2(toNumber(r.gross) - tareOf(m)))
const amountOf = (m, r) => round2(netOf(m, r) * price.value)
const blank = (r) => String(r.gross).trim() === ''
const complete = (m, r) => toNumber(r.gross) > tareOf(m) // กรอกครบ = น้ำหนักสินค้ามากกว่าน้ำหนักภาชนะ (ภาชนะ/ราคาเติมให้อัตโนมัติ)

const list = computed(() => rows[mode.value])
const canAdd = computed(() => list.value.length > 0 && complete(mode.value, list.value[list.value.length - 1]))
const tare = computed(() => tareOf(mode.value))

const snapshot = () => JSON.stringify(['none', 'keng'].map((m) => rows[m].filter((r) => complete(m, r)).map((r) => [r.uid ?? 0, String(r.gross)])))
const dirty = computed(() => snapshot() !== initial)

// สรุปของเกรดนี้ (ทั้ง 2 แบบภาชนะ เฉพาะแถวที่กรอกครบ)
const sum = computed(() => {
  let n = 0, net = 0, amount = 0
  for (const m of ['none', 'keng']) for (const r of rows[m]) if (complete(m, r)) { n++; net += netOf(m, r); amount += amountOf(m, r) }
  return { n, net: round2(net), amount: round2(amount) }
})
const countOf = (m) => rows[m].filter((r) => complete(m, r)).length

function ensureRow(m) { if (!rows[m].length) rows[m].push(newRow()) }
const focusRow = (key) => nextTick(() => document.getElementById(`gw-${key}`)?.focus())
const focusFirstEditing = () => { const r = list.value.find((x) => x.editing); if (r) focusRow(r.key) }

watch(() => props.modelValue, (open) => {
  if (!open || !props.product) return
  error.value = ''
  askDiscard.value = false
  members.load()
  settings.load()
  for (const m of ['none', 'keng']) {
    rows[m] = cart.linesOf(props.product.id, m).map((l) => ({ key: ++keySeq, uid: l.uid, gross: String(l.gross), editing: false }))
  }
  mode.value = !rows.none.length && rows.keng.length ? 'keng' : 'none'
  ensureRow(mode.value)
  initial = snapshot()
  setTimeout(focusFirstEditing, 120) // หลัง animation ของหน้าต่าง และหลัง BaseModal ย้าย focus เสร็จ
})

function setMode(m) {
  mode.value = m
  ensureRow(m)
  error.value = ''
  askDiscard.value = false
  nextTick(focusFirstEditing)
}

function addRow() {
  if (!canAdd.value) return
  const last = list.value[list.value.length - 1]
  last.editing = false
  const r = newRow()
  list.value.push(r)
  error.value = ''
  focusRow(r.key)
}
function onWeight(e, r) {
  const v = sanitizeDecimal(e.target.value)
  if (v !== e.target.value) e.target.value = v
  r.gross = v
  error.value = ''
}
function onKey(e, r, i) {
  if (e.key === 'Tab' && !e.shiftKey) {
    // Tab ที่ช่องน้ำหนักของแถวสุดท้าย (กรอกครบแล้ว) = เพิ่มแถวใหม่ · ยังไม่ครบ = Tab ตามปกติ
    if (i === list.value.length - 1 && complete(mode.value, r)) { e.preventDefault(); addRow() }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (!complete(mode.value, r)) return
    if (i === list.value.length - 1) addRow()
    else r.editing = false
  }
}
function toggleEdit(r) {
  if (r.editing) {
    if (!complete(mode.value, r)) { error.value = `น้ำหนักสินค้าต้องมากกว่าน้ำหนักภาชนะ (${formatKg(tare.value)})`; return }
    r.editing = false
  } else {
    r.editing = true
    focusRow(r.key)
  }
}
function removeRow(i) {
  list.value.splice(i, 1)
  ensureRow(mode.value)
  error.value = ''
}

function save() {
  for (const m of ['none', 'keng']) {
    const i = rows[m].findIndex((r) => !blank(r) && !complete(m, r))
    if (i >= 0) {
      mode.value = m
      rows[m][i].editing = true
      error.value = `แถวที่ ${i + 1} (${MODES.find((x) => x.id === m).label}): น้ำหนักสินค้าต้องมากกว่าน้ำหนักภาชนะ (${formatKg(tareOf(m))})`
      focusRow(rows[m][i].key)
      return
    }
  }
  const before = cart.lines.length
  for (const m of ['none', 'keng']) {
    cart.setGroup(props.product, settings.byId[m] ?? { id: m, short: m }, rows[m].filter((r) => !blank(r)).map((r) => ({ uid: r.uid, gross: r.gross })))
  }
  if (dirty.value || cart.lines.length !== before) toast.success(`บันทึก ${props.product.name} แล้ว · ${sum.value.n} แถว`)
  emit('update:modelValue', false)
}

// ปิดหน้าต่าง (ปุ่มแดง / Esc / คลิกพื้นหลัง): ถ้ามีข้อมูลที่ยังไม่บันทึก ถามก่อนทิ้ง
function onModel(v) {
  if (v) return emit('update:modelValue', true)
  if (dirty.value && !askDiscard.value) { askDiscard.value = true; return }
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal :model-value="modelValue" :title="product?.name || ''" width="920px" @update:model-value="onModel">
    <template #lead><span class="thumb"><LumpImage /></span></template>

    <div class="top">
      <div class="top__left">
        <p class="price"><b>{{ formatNumber(product?.price) }}</b> บาท / กก.</p>
        <!-- ② เลือกได้แค่ 2 แบบ -->
        <div class="mode" role="radiogroup" aria-label="ภาชนะที่ใส่สินค้า">
          <button v-for="m in MODES" :key="m.id" type="button" role="radio" :aria-checked="mode === m.id" class="mode__btn" :class="{ on: mode === m.id }" @click="setMode(m.id)">
            {{ m.label }}<i v-if="countOf(m.id)">{{ countOf(m.id) }}</i>
          </button>
        </div>
        <p class="hint">{{ mode === 'keng' ? `หักน้ำหนักตะกร้าเข่ง ${formatKg(tare)} ต่อแถว` : 'ไม่หักน้ำหนักภาชนะ' }}</p>
      </div>

      <!-- ① เลือกลูกค้าที่นี่ (แผงขวาแสดงเป็นข้อความ) -->
      <section class="who" aria-label="ลูกค้า">
        <h3>ลูกค้า</h3>
        <div class="seg" role="radiogroup" aria-label="ประเภทลูกค้า">
          <button type="button" role="radio" :aria-checked="cart.customerType === 'member'" :class="{ on: cart.customerType === 'member' }" @click="cart.customerType = 'member'">ลูกค้าประจำ</button>
          <button type="button" role="radio" :aria-checked="cart.customerType === 'general'" :class="{ on: cart.customerType === 'general' }" @click="cart.customerType = 'general'">ลูกค้าทั่วไป</button>
        </div>
        <MemberCombobox v-if="cart.customerType === 'member'" v-model="cart.memberId" :members="members.items" />
        <p v-if="cart.customerType === 'member' && !cart.memberId" class="who__warn">เลือกลูกค้าประจำก่อนพิมพ์บิล</p>
        <p v-else-if="cart.customerType === 'general'" class="who__note">ใช้กับผู้ที่ไม่ใช่ลูกค้าประจำ (ไม่ต้องระบุชื่อ)</p>
      </section>
    </div>

    <!-- ③ ตารางน้ำหนัก -->
    <div class="tbl">
      <table>
        <thead>
          <tr><th v-for="c in COLS" :key="c" scope="col">{{ c }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in list" :key="r.key" :class="{ 'is-edit': r.editing }">
            <td class="c-no">{{ i + 1 }}</td>
            <td class="num">{{ formatNumber(tare) }} <em>กก.</em></td>
            <td class="num">
              <span v-if="r.editing" class="wbox">
                <input :id="`gw-${r.key}`" :value="r.gross" inputmode="decimal" placeholder="0.00" maxlength="9" autocomplete="off" :aria-label="`น้ำหนักสินค้า แถวที่ ${i + 1}`" @input="onWeight($event, r)" @keydown="onKey($event, r, i)" />
                <em>กก.</em>
              </span>
              <template v-else>{{ formatNumber(toNumber(r.gross)) }} <em>กก.</em></template>
            </td>
            <td class="num">{{ formatNumber(price) }}</td>
            <td class="num total">
              <template v-if="complete(mode, r)">{{ formatMoney(amountOf(mode, r)) }}<small>สุทธิ {{ formatKg(netOf(mode, r)) }}</small></template>
              <span v-else class="dash">—</span>
            </td>
            <td class="c-act">
              <button type="button" class="act" :class="{ 'act--ok': r.editing }" :aria-label="r.editing ? `ยืนยันแถวที่ ${i + 1}` : `แก้ไขแถวที่ ${i + 1}`" :title="r.editing ? 'ยืนยันแถวนี้' : 'แก้ไข'" @click="toggleEdit(r)"><AppIcon :name="r.editing ? 'check' : 'edit'" :size="15" /></button>
            </td>
            <td class="c-act">
              <button type="button" class="act act--del" :aria-label="`ลบแถวที่ ${i + 1}`" title="ลบ" @click="removeRow(i)"><AppIcon name="trash" :size="15" /></button>
            </td>
          </tr>

          <!-- แถวถัดไป: ปิดไว้จนกว่าแถวก่อนหน้าจะกรอกครบ -->
          <tr class="ghost" :class="{ 'ghost--on': canAdd }">
            <td class="c-no">
              <button type="button" class="plus" :disabled="!canAdd" :aria-label="`เพิ่มแถวที่ ${list.length + 1}`" :title="canAdd ? 'เพิ่มแถว (Tab)' : 'กรอกแถวก่อนหน้าให้ครบก่อน'" @click="addRow"><AppIcon name="plus" :size="14" /></button>
            </td>
            <td v-for="n in 4" :key="n" class="dash">—</td>
            <td class="c-act" /><td class="c-act" />
          </tr>
        </tbody>
      </table>
    </div>

    <p class="note">กรอกน้ำหนักสินค้า (ที่ชั่งได้ รวมภาชนะ) แล้วกด <kbd>Tab</kbd> เพื่อเพิ่มแถวถัดไป · ยอดรวม = (น้ำหนักสินค้า − น้ำหนักภาชนะ) × ราคา</p>

    <div class="sum" aria-live="polite">
      <span>{{ product?.name }}: <b>{{ sum.n }}</b> แถว</span>
      <span>น้ำหนักสุทธิ <b>{{ formatKg(sum.net) }}</b></span>
      <strong>{{ formatMoney(sum.amount) }}</strong>
    </div>

    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <div v-if="askDiscard" class="warn" role="alertdialog" aria-label="ยืนยันการปิด">
      <span>มีข้อมูลที่ยังไม่ได้บันทึก</span>
      <button type="button" class="warn__back" @click="askDiscard = false">กลับไปแก้ต่อ</button>
      <button type="button" class="warn__drop" @click="emit('update:modelValue', false)">ปิดโดยไม่บันทึก</button>
    </div>

    <template #footer>
      <BaseButton variant="soft" size="lg" @click="onModel(false)">ยกเลิก</BaseButton>
      <BaseButton size="lg" @click="save"><AppIcon name="check" :size="16" /> บันทึกลงรายการ</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.thumb { width: 72px; height: 54px; flex: none; }
.top { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; margin: -8px 0 16px; }
.price { font-size: 13px; color: var(--slate-500); line-height: 1.5; margin-bottom: 10px; }
.price b { color: var(--blue-600); font-size: 22px; margin-right: 2px; }

.mode { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--slate-100); border-radius: var(--radius-md); }
.mode__btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--slate-500); white-space: nowrap; transition: background .15s, color .15s; }
.mode__btn.on { background: #fff; color: var(--blue-700); box-shadow: 0 1px 3px rgba(15, 23, 42, .14); }
.mode__btn i { font-style: normal; min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--blue-100); color: var(--blue-700); font-size: 11px; }
.hint { margin-top: 8px; font-size: 12px; color: var(--slate-500); }

.who { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); position: relative; z-index: 5; }
.who h3 { font-size: 11px; font-weight: 700; letter-spacing: .3px; color: var(--slate-500); }
.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--slate-100); border-radius: var(--radius-md); }
.seg button { padding: 7px 8px; border-radius: 9px; font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--slate-500); transition: background .15s, color .15s; }
.seg button.on { background: #fff; color: var(--blue-700); box-shadow: 0 1px 3px rgba(15, 23, 42, .12); }
.who__warn { font-size: 11px; color: var(--amber-700); }
.who__note { font-size: 11px; color: var(--slate-400); }

.tbl { border: 1px solid var(--slate-200); border-radius: var(--radius-md); overflow: hidden; max-height: 246px; overflow-y: auto; background: #fff; } /* หัวตาราง 36 + 4 แถว x 52 + ขอบ = แสดง 4 แถว ที่เหลือเลื่อนดู */
table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--slate-50); height: 36px; padding: 0 8px; font-size: 12px; font-weight: 700; color: var(--slate-600); text-align: right; border-bottom: 1px solid var(--slate-200); white-space: nowrap; }
thead th:first-child { text-align: center; }
thead th:nth-child(6), thead th:nth-child(7) { text-align: center; }
th:nth-child(1) { width: 64px; } th:nth-child(6), th:nth-child(7) { width: 64px; } th:nth-child(2) { width: 17%; } th:nth-child(4) { width: 14%; }
tbody td { padding: 7px 8px; height: 52px; border-bottom: 1px solid var(--slate-100); }
tbody tr:last-child td { border-bottom: 0; }
.c-no { text-align: center; font-weight: 700; color: var(--slate-600); }
.num { text-align: right; font-weight: 600; color: var(--slate-800); font-variant-numeric: tabular-nums; }
.num em { font-style: normal; font-size: 11px; font-weight: 400; color: var(--slate-400); }
.total { color: var(--blue-600); font-size: 14px; font-weight: 700; }
.total small { display: block; font-size: 10px; font-weight: 500; color: var(--slate-400); }
.dash { text-align: right; color: var(--slate-300); font-weight: 500; }
.is-edit { background: rgba(239, 246, 255, .55); }
.wbox { position: relative; display: flex; align-items: center; }
.wbox input { width: 100%; height: 36px; padding: 0 34px 0 10px; text-align: right; font-size: 14px; font-weight: 700; color: var(--slate-900); background: #fff; border: 1px solid var(--slate-300); border-radius: 10px; outline: none; }
.wbox input:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.wbox input::placeholder { color: var(--slate-300); font-weight: 500; }
.wbox em { position: absolute; right: 9px; pointer-events: none; }
.c-act { text-align: center; }
.act { width: 32px; height: 32px; border-radius: 9px; display: inline-grid; place-items: center; color: var(--slate-500); transition: background .15s, color .15s; }
.act:hover { background: var(--blue-50); color: var(--blue-700); }
.act--ok { background: #dcfce7; color: #15803d; }
.act--ok:hover { background: #bbf7d0; color: #166534; }
.act--del:hover { background: var(--red-50); color: #dc2626; }

.ghost td { background: var(--slate-50); color: var(--slate-300); }
.ghost .plus { width: 30px; height: 30px; border-radius: 50%; display: inline-grid; place-items: center; border: 1.5px dashed var(--slate-300); color: var(--slate-300); cursor: not-allowed; }
.ghost--on td { background: #fff; }
.ghost--on .plus { border: 1.5px solid var(--blue-600); background: var(--blue-600); color: #fff; cursor: pointer; box-shadow: var(--shadow-blue); }
.ghost--on .plus:hover { filter: brightness(1.08); }
.ghost--on td.dash { color: var(--slate-300); }

.note { margin-top: 10px; font-size: 12px; line-height: 1.6; color: var(--slate-500); }
kbd { padding: 1px 7px; border: 1px solid var(--slate-300); border-bottom-width: 2px; border-radius: 6px; background: #fff; font: 600 11px/1.6 inherit; color: var(--slate-700); }
.sum { display: flex; align-items: baseline; justify-content: flex-end; gap: 18px; margin-top: 12px; padding: 12px 16px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); font-size: 13px; color: var(--slate-600); }
.sum b { color: var(--slate-900); }
.sum strong { font-size: 22px; color: var(--blue-600); }
.alert { margin-top: 10px; background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; }
.warn { margin-top: 10px; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--amber-50); border: 1px solid #fde68a; color: var(--amber-700); font-size: 12px; font-weight: 600; }
.warn span { flex: 1; }
.warn__back { color: var(--blue-700); font-weight: 700; }
.warn__drop { color: #dc2626; font-weight: 700; }
@media (max-width: 900px) { .top { grid-template-columns: 1fr; } }
</style>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseModal from '@/components/BaseModal.vue'
import Pagination from '@/components/Pagination.vue'
import TransportSummaryModal from '@/components/TransportSummaryModal.vue'
import TripSourcePicker from '@/components/TripSourcePicker.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { transportService } from '@/services/transportService'
import { stockService } from '@/services/stockService'
import { getErrorMessage } from '@/services/http'
import { bangkokDate, addDays, formatThaiDate } from '@/utils/dates'
import { PRODUCT_TYPES, productLabel } from '@/utils/finance'
import { formatKg, formatMoney, formatNumber, round2, sanitizeDecimal, toNumber } from '@/utils/format'
import { calcLoss, durationMinutes, formatDuration } from '@/utils/transport'

const PAGE_SIZE = 10
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('transport.create'))

// ---- ช่วงวันที่ของรายการ ----
const range = reactive({ from: addDays(bangkokDate(), -29), to: bangkokDate() })
const page = ref(1)
const data = ref(null)
const loading = ref(false)
let req = 0

async function load() {
  if (!range.from || !range.to || range.from > range.to) return
  const id = ++req
  loading.value = true
  try {
    const res = await transportService.list({ from: range.from, to: range.to, page: page.value, pageSize: PAGE_SIZE })
    if (id === req) data.value = res
  } catch (e) {
    if (id === req) toast.error(getErrorMessage(e, 'โหลดรายการขนส่งไม่สำเร็จ'))
  } finally {
    if (id === req) loading.value = false
  }
}
watch(() => [range.from, range.to], () => { page.value = 1; load() })
watch(page, load)
onMounted(load)

const trips = computed(() => data.value?.data ?? [])

// ---- เลือกเที่ยวเพื่อดูสรุป (คงรายการที่เลือกไว้แม้เปลี่ยนหน้า) ----
const selected = ref(new Set())
const selCount = computed(() => selected.value.size)
const pageAll = computed(() => trips.value.length > 0 && trips.value.every((t) => selected.value.has(t.id)))
const pageSome = computed(() => trips.value.some((t) => selected.value.has(t.id)) && !pageAll.value)
function toggle(id) {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
function togglePage() {
  const next = new Set(selected.value)
  for (const t of trips.value) pageAll.value ? next.delete(t.id) : next.add(t.id)
  selected.value = next
}
const clearSel = () => { selected.value = new Set() }
function onRow(e, id) { if (!e.target.closest('button, input, a')) toggle(id) } // คลิกที่แถวเพื่อเลือก/ยกเลิก

const sumOpen = ref(false)
const sumMode = ref('range')
function openSummary(mode) { sumMode.value = mode; sumOpen.value = true }
const summary = computed(() => data.value?.summary)

// ---- ฟอร์ม (เพิ่ม/แก้ไข) ----
const blank = () => ({ date: bangkokDate(), shippedKg: '', departAt: '', billAt: '', factoryNetKg: '', factoryPricePerKg: '', factoryAmount: '', productType: 'CUP_LUMP', stockKg: '', note: '' })
const amountEdited = ref(false) // true = ผู้ใช้พิมพ์ยอดบิลเอง (ไม่คำนวณทับให้)
const open = ref(false)
const editing = ref(null) // Trip | null
const form = reactive(blank())
const touched = ref(false)
const dayFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const shortDate = (d) => dayFmt.format(new Date(`${d}T00:00:00`))
// ยางที่ขายในเที่ยวนี้ (เลือกจากยางรอขาย) — ids = ใบรับซื้อที่ตัดเข้าเที่ยว · includeFoam = นับขี้ฟองรวมด้วย
const srcSel = ref({ ids: [], includeFoam: false })
const shippedTouched = ref(false) // true = ผู้ใช้กรอก/แก้น้ำหนักที่ส่งเอง → ไม่เติมจากยางที่เลือกทับ
let autoFill = false
watch(() => form.shippedKg, () => { if (!autoFill) shippedTouched.value = true })
function onSrcTotal(t) {
  if (shippedTouched.value || !(t.kg > 0)) return
  autoFill = true
  form.shippedKg = String(round2(t.kg))
  nextTick(() => { autoFill = false })
}
watch(() => form.productType, () => { if (open.value) srcSel.value = { ids: [], includeFoam: false } })
// ยางรอขายรวม (ไว้เห็นภาพรวมบนหน้าขนส่ง)
const stockSummary = ref(null)
async function loadStock() { try { stockSummary.value = (await stockService.unsold()).summary } catch { stockSummary.value = null } }
onMounted(loadStock)
const saving = ref(false)

function openNew() { editing.value = null; Object.assign(form, blank()); srcSel.value = { ids: [], includeFoam: false }; shippedTouched.value = false; amountEdited.value = false; touched.value = false; open.value = true }
function openEdit(t) {
  editing.value = t
  Object.assign(form, { date: t.date, shippedKg: String(t.shippedKg), departAt: t.departAt, billAt: t.billAt, factoryNetKg: String(t.factoryNetKg), factoryPricePerKg: t.factoryPricePerKg != null ? String(t.factoryPricePerKg) : '', factoryAmount: t.factoryAmount != null ? String(t.factoryAmount) : '', productType: t.productType ?? 'CUP_LUMP', stockKg: t.stockKg != null ? String(t.stockKg) : '', note: t.note ?? '' })
  // ยอดบิลที่ไม่เท่ากับ น้ำหนัก × ราคา = เคยพิมพ์เอง (เช่น โรงงานหักความชื้น) → อย่าคำนวณทับ
  amountEdited.value = t.factoryAmount != null && round2(toNumber(t.factoryNetKg) * toNumber(t.factoryPricePerKg)) !== round2(toNumber(t.factoryAmount))
  srcSel.value = { ids: [...(t.sourcePurchaseIds ?? [])], includeFoam: !!t.includeFoam }
  shippedTouched.value = true // แก้เที่ยวเดิม: ไม่เติมน้ำหนักที่ส่งทับ
  touched.value = false
  open.value = true
}

// เวลาแบบ HH:mm — พิมพ์ได้ทั้ง 1430 / 14:30 / 14.30
function fmtTime(v) {
  const d = String(v).replace(/[^\d]/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}

// ยอดบิล = น้ำหนักสุทธิ × ราคา/กก. (คำนวณให้อัตโนมัติ จนกว่าจะพิมพ์ยอดเอง)
watch(() => [form.factoryNetKg, form.factoryPricePerKg], () => {
  if (amountEdited.value) return
  const n = toNumber(form.factoryNetKg); const p = toNumber(form.factoryPricePerKg)
  form.factoryAmount = n > 0 && p > 0 ? String(round2(n * p)) : ''
})
const onAmount = (v) => { amountEdited.value = v !== ''; return sanitizeDecimal(v, 2) }

const minutes = computed(() => durationMinutes(form.departAt, form.billAt))
const loss = computed(() => calcLoss(form.shippedKg, form.factoryNetKg, minutes.value))

const errors = computed(() => {
  const e = {}
  if (!form.date) e.date = 'เลือกวันที่'
  if (!(toNumber(form.shippedKg) > 0)) e.shippedKg = 'กรอกน้ำหนักที่ขนส่ง'
  if (minutes.value == null) { e.departAt = 'กรอกเวลา เช่น 08:30'; e.billAt = 'กรอกเวลา เช่น 14:30' }
  if (!(toNumber(form.factoryNetKg) > 0)) e.factoryNetKg = 'กรอกน้ำหนักสุทธิที่โรงงานชั่งได้'
  return e
})
const err = (k) => (touched.value ? errors.value[k] : '')

async function save() {
  touched.value = true
  if (Object.keys(errors.value).length) return
  saving.value = true
  const payload = { date: form.date, shippedKg: toNumber(form.shippedKg), departAt: form.departAt, billAt: form.billAt, factoryNetKg: toNumber(form.factoryNetKg), factoryPricePerKg: toNumber(form.factoryPricePerKg) > 0 ? toNumber(form.factoryPricePerKg) : null, factoryAmount: toNumber(form.factoryAmount) > 0 ? toNumber(form.factoryAmount) : null, productType: form.productType, stockKg: toNumber(form.stockKg) > 0 ? toNumber(form.stockKg) : null, note: form.note.trim() || undefined }
  if (editing.value || srcSel.value.ids.length) Object.assign(payload, { sourcePurchaseIds: srcSel.value.ids, includeFoam: srcSel.value.includeFoam }) // แก้ไข: ส่งเสมอ (แทนที่/ปล่อยคืนยาง)
  try {
    if (editing.value) await transportService.update(editing.value.id, payload)
    else await transportService.create(payload)
    toast.success('บันทึกเที่ยวขนส่งแล้ว')
    open.value = false
    await load()
    loadStock()
  } catch (e) {
    toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ'))
  } finally {
    saving.value = false
  }
}

// ---- ลบ ----
const delTarget = ref(null)
const delOpen = computed({ get: () => !!delTarget.value, set: (v) => { if (!v) delTarget.value = null } })
async function confirmDelete() {
  const t = delTarget.value
  delTarget.value = null
  if (!t) return
  try {
    await transportService.remove(t.id)
    if (selected.value.has(t.id)) toggle(t.id)
    toast.success('ลบเที่ยวขนส่งแล้ว (ยางที่ผูกไว้กลับไปเป็นยางรอขาย)')
    loadStock()
    if (trips.value.length === 1 && page.value > 1) page.value--
    else await load()
  } catch (e) {
    toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ'))
  }
}

const pctText = (n) => (n == null ? '–' : `${formatNumber(n)}%`)
const tone = (pct) => (pct == null ? '' : pct < 0 ? 'neg' : 'ok')
</script>

<template>
  <section class="tp glass">
    <header class="head">
      <div>
        <h1>การขนส่ง</h1>
        <p>บันทึกการขนส่งยางก้อนถ้วยไปโรงงาน และคำนวณอัตราการสูญเสียน้ำของแต่ละเที่ยว</p>
      </div>
      <div class="tools">
        <label class="date"><span>ตั้งแต่</span><input v-model="range.from" type="date" :max="range.to" /></label>
        <label class="date"><span>ถึง</span><input v-model="range.to" type="date" :min="range.from" /></label>
        <BaseButton variant="soft" @click="openSummary(selCount ? 'selected' : 'range')"><AppIcon name="chart" :size="14" /> สรุปผล</BaseButton>
        <BaseButton v-if="canEdit" @click="openNew"><AppIcon name="plus" :size="14" /> เพิ่มเที่ยวขนส่ง</BaseButton>
      </div>
    </header>

    <!-- ยางรอขาย (รับซื้อแล้ว ยังไม่ได้ขายให้โรงงาน): ขายต่อวัน / ค้างคืน — เปลี่ยนสถานะได้ที่เมนู "ยางรอขาย" -->
    <div v-if="stockSummary" class="tiles tiles--stock">
      <RouterLink to="/stock" class="tile tile--day"><small>ยางรอขาย · ขายต่อวัน ({{ stockSummary.sameDay.bills }} ใบ)</small><b>{{ formatKg(stockSummary.sameDay.cupKg) }}</b><em>ก้อนถ้วย · รวมขี้ฟอง {{ formatKg(stockSummary.sameDay.cupKg + stockSummary.sameDay.foamKg) }} <template v-if="stockSummary.sameDay.foamKg > 0">(ขี้ฟอง {{ formatKg(stockSummary.sameDay.foamKg) }})</template></em></RouterLink>
      <RouterLink to="/stock" class="tile tile--night"><small>ยางรอขาย · ค้างคืน ({{ stockSummary.overnight.bills }} ใบ)</small><b>{{ formatKg(stockSummary.overnight.cupKg) }}</b><em>ก้อนถ้วย · รวมขี้ฟอง {{ formatKg(stockSummary.overnight.cupKg + stockSummary.overnight.foamKg) }} <template v-if="stockSummary.overnight.foamKg > 0">(ขี้ฟอง {{ formatKg(stockSummary.overnight.foamKg) }})</template></em></RouterLink>
    </div>

    <div v-if="summary" class="tiles">
      <div class="tile"><small>จำนวนเที่ยว</small><b>{{ summary.trips }}</b></div>
      <div class="tile"><small>น้ำหนักที่ส่งรวม</small><b>{{ formatKg(summary.shippedKg) }}</b></div>
      <div class="tile"><small>โรงงานชั่งได้รวม</small><b>{{ formatKg(summary.factoryNetKg) }}</b></div>
      <div class="tile tile--money"><small>ยอดบิลโรงงานรวม</small><b>{{ summary.factoryAmount ? formatMoney(summary.factoryAmount) : '–' }}</b><em>รายรับจากการขาย</em></div>
      <div class="tile tile--hi"><small>สูญเสียน้ำเฉลี่ยรวม</small><b>{{ pctText(summary.lossPct) }}</b><em>{{ formatKg(summary.lossKg) }}</em></div>
    </div>

    <div v-if="selCount" class="selbar" role="status">
      <span>เลือกแล้ว <b>{{ selCount }}</b> เที่ยว</span>
      <span class="selbar__act">
        <BaseButton @click="openSummary('selected')">ดูสรุปผลที่เลือก</BaseButton>
        <BaseButton variant="soft" @click="clearSel">ล้างที่เลือก</BaseButton>
      </span>
    </div>

    <div class="scroll">
      <p v-if="loading && !data" class="state">กำลังโหลด…</p>
      <p v-else-if="!trips.length" class="state">ยังไม่มีการขนส่งในช่วงนี้<br /><small>กด "เพิ่มเที่ยวขนส่ง" เพื่อบันทึกเที่ยวแรก</small></p>
      <table v-else class="tbl" :aria-busy="loading">
        <thead>
          <tr>
            <th class="ck"><input type="checkbox" :checked="pageAll" :indeterminate="pageSome" aria-label="เลือกทั้งหน้านี้" @change="togglePage" /></th>
            <th>วันที่ / เที่ยว</th><th>ยางจากการซื้อวัน</th><th class="r">น้ำหนักที่ส่ง</th><th>ออกเดินทาง</th><th>รับบิลโรงงาน</th><th>ระยะเวลา</th>
            <th class="r">โรงงานชั่งได้</th><th class="r">ยอดบิลโรงงาน</th><th class="r">สูญเสีย (กก.)</th><th class="r">สูญเสียน้ำ</th><th class="r">%/ชม.</th><th v-if="canEdit" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in trips" :key="t.id" :class="{ sel: selected.has(t.id) }" @click="onRow($event, t.id)">
            <td class="ck"><input type="checkbox" :checked="selected.has(t.id)" :aria-label="`เลือกเที่ยวที่ ${t.tripNo} วันที่ ${t.date}`" @change="toggle(t.id)" /></td>
            <td><b>{{ formatThaiDate(t.date) }}</b><br /><small>เที่ยวที่ {{ t.tripNo }}<template v-if="t.productType === 'FOAM'"> · <span class="ptag">ขี้ฟอง</span></template></small></td>
            <td class="srcs"><template v-if="t.sources?.length"><span v-for="x in t.sources" :key="x.date" class="schip" :class="{ old: x.date < t.date }" :title="`ซื้อ ${x.date} · ${x.bills} ใบ · ต้นทุน ${formatMoney(x.cost)}`">{{ shortDate(x.date) }}</span></template><span v-else class="muted">–</span></td>
            <td class="r">{{ formatKg(t.shippedKg) }}</td>
            <td>{{ t.departAt }} น.</td>
            <td>{{ t.billAt }} น.</td>
            <td>{{ formatDuration(t.durationMin) }}</td>
            <td class="r">{{ formatKg(t.factoryNetKg) }}</td>
            <td class="r">{{ t.factoryAmount != null ? formatMoney(t.factoryAmount) : '–' }}</td>
            <td class="r">{{ formatNumber(t.lossKg) }}</td>
            <td class="r"><span class="pill" :class="tone(t.lossPct)">{{ pctText(t.lossPct) }}</span></td>
            <td class="r">{{ pctText(t.lossPctPerHour) }}</td>
            <td v-if="canEdit" class="act">
              <button type="button" aria-label="แก้ไข" title="แก้ไข" @click="openEdit(t)"><AppIcon name="edit" :size="14" /></button>
              <button type="button" aria-label="ลบ" title="ลบ" @click="delTarget = t"><AppIcon name="trash" :size="14" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer v-if="data?.total > 0" class="foot">
      <Pagination v-model:page="page" :total-pages="data.totalPages" :total="data.total" :page-size="PAGE_SIZE" :disabled="loading" />
    </footer>

    <TransportSummaryModal v-model="sumOpen" :mode="sumMode" :ids="[...selected]" :from="range.from" :to="range.to" />

    <BaseModal v-model="open" :title="editing ? 'แก้ไขเที่ยวขนส่ง' : 'เพิ่มเที่ยวขนส่ง'" width="560px">
      <div class="form">
        <label class="f"><span>วันที่ขนส่ง</span><input v-model="form.date" type="date" :class="{ bad: err('date') }" /></label>

        <div class="f">
          <span>สินค้าที่ขนส่ง</span>
          <div class="pt" role="radiogroup" aria-label="สินค้าที่ขนส่ง">
            <button v-for="p in PRODUCT_TYPES" :key="p.code" type="button" role="radio" :aria-checked="form.productType === p.code" :class="{ on: form.productType === p.code }" @click="form.productType = p.code">{{ p.label }}</button>
          </div>
        </div>

        <TripSourcePicker v-if="open" :key="(editing?.id ?? 'new') + form.productType" v-model="srcSel" :product-type="form.productType" :trip-id="editing?.id ?? null" :trip-date="form.date" @total="onSrcTotal" />

        <h3>1) น้ำหนัก{{ productLabel(form.productType) }}ที่ขนส่ง</h3>
        <BaseInput v-model="form.shippedKg" label="น้ำหนักที่ส่ง (กก.)" inputmode="decimal" placeholder="เช่น 5200" :format="(v) => sanitizeDecimal(v, 2)" :error="err('shippedKg')" />
        <p v-if="srcSel.ids.length" class="hint">น้ำหนักที่ส่งเติมจากยางที่เลือกให้ — แก้ได้ถ้าชั่งใหม่ก่อนขึ้นรถ (น้ำหนักตอนซื้อของใบที่เลือกถูกตัดจากยางรอขายครบทุกกิโลกรัม)</p>
        <BaseInput v-else v-model="form.stockKg" label="ตัดสต็อกยางค้างคืน (กก. ตามน้ำหนักตอนซื้อ) — ไม่บังคับ" inputmode="decimal" placeholder="เว้นว่าง = เท่ากับน้ำหนักที่ส่ง" :format="(v) => sanitizeDecimal(v, 2)" />
        <p v-if="!srcSel.ids.length" class="hint">ถ้ายางพักค้างคืนแล้วน้ำหนักลดลง ให้ใส่น้ำหนักตอนซื้อของยางก้อนที่ส่งไป (เช่น ส่ง 950 แต่ตอนซื้อ 1,000 ใส่ 1000) เพื่อไม่ให้ยอดยางคงเหลือค้างเกินจริง</p>

        <h3>2) ระยะเวลาขนส่ง</h3>
        <div class="row">
          <BaseInput v-model="form.departAt" label="ออกเดินทางกี่โมง" inputmode="numeric" placeholder="08:30" :maxlength="5" :format="fmtTime" :error="err('departAt')" />
          <BaseInput v-model="form.billAt" label="ได้รับบิลจากโรงงานกี่โมง" inputmode="numeric" placeholder="14:30" :maxlength="5" :format="fmtTime" :error="err('billAt')" />
        </div>
        <p class="hint">ระยะเวลา: <b>{{ formatDuration(minutes) }}</b><template v-if="minutes != null"> (เวลารับบิลน้อยกว่าเวลาออก = ข้ามเที่ยงคืน)</template></p>

        <h3>3) น้ำหนักสุทธิที่โรงงานชั่งได้</h3>
        <BaseInput v-model="form.factoryNetKg" label="น้ำหนักสุทธิ (กก.)" inputmode="decimal" placeholder="เช่น 5000" :format="(v) => sanitizeDecimal(v, 2)" :error="err('factoryNetKg')" />

        <h3>4) ยอดเงินตามบิลโรงงาน <small>(ไม่บังคับ · ใช้คำนวณรายรับและกำไร)</small></h3>
        <div class="row">
          <BaseInput v-model="form.factoryPricePerKg" label="ราคาที่โรงงานรับซื้อ (บาท/กก.)" inputmode="decimal" placeholder="เช่น 42.50" :format="(v) => sanitizeDecimal(v, 2)" />
          <BaseInput :model-value="form.factoryAmount" label="ยอดเงินตามบิล (บาท)" inputmode="decimal" placeholder="คำนวณให้อัตโนมัติ" :format="onAmount" @update:model-value="(v) => (form.factoryAmount = v)" />
        </div>
        <p class="hint">ยอดบิล = น้ำหนักสุทธิที่โรงงานชั่ง × ราคา/กก. · ถ้าบิลจริงไม่ตรง (เช่น หักความชื้น) พิมพ์ยอดเองได้</p>

        <BaseInput v-model="form.note" label="หมายเหตุ (ถ้ามี)" placeholder="เช่น ทะเบียนรถ / ชื่อโรงงาน" :maxlength="200" />

        <div class="result" :class="loss ? tone(loss.pct) : 'idle'" aria-live="polite">
          <template v-if="loss">
            <small>5) อัตราการสูญเสียน้ำ</small>
            <b>{{ pctText(loss.pct) }}</b>
            <span>สูญเสีย {{ formatKg(loss.lossKg) }} จาก {{ formatKg(toNumber(form.shippedKg)) }}<template v-if="loss.perHour != null"> · เฉลี่ย {{ pctText(loss.perHour) }} ต่อชั่วโมง</template></span>
            <span v-if="loss.pct < 0" class="warn">โรงงานชั่งได้มากกว่าที่ส่ง — ตรวจสอบตัวเลขอีกครั้ง</span>
          </template>
          <template v-else><small>5) อัตราการสูญเสียน้ำ</small><span>กรอกน้ำหนักข้อ 1 และข้อ 3 เพื่อดูผลลัพธ์</span></template>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="soft" @click="open = false">ยกเลิก</BaseButton>
        <BaseButton :loading="saving" @click="save">บันทึก</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model="delOpen" title="ลบเที่ยวขนส่ง" width="400px">
      <p class="confirm">ต้องการลบเที่ยวที่ <b>{{ delTarget?.tripNo }}</b> ของวันที่ {{ formatThaiDate(delTarget?.date) }} ใช่ไหม?</p>
      <template #footer>
        <BaseButton variant="soft" @click="delOpen = false">ไม่ลบ</BaseButton>
        <BaseButton variant="dark" @click="confirmDelete">ลบ</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.tp { flex: 1; min-width: 0; min-height: 0; padding: 20px; display: flex; flex-direction: column; overflow: hidden; }
.head { flex: none; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 16px; flex-wrap: wrap; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }
.tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.date { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate-500); }
.date input, .f input { height: 36px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: #fff; font: inherit; font-size: 13px; color: var(--slate-800); }

.tiles { flex: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 16px 0; }
.tile { padding: 12px 14px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 2px; }
.tile small { font-size: 11px; color: var(--slate-500); }
.tile b { font-size: 18px; font-weight: 800; color: var(--slate-900); }
.tile em { font-style: normal; font-size: 11px; color: var(--slate-500); }
.tile--hi { background: var(--blue-50); border-color: var(--blue-100); }
.tile--hi b { color: var(--blue-700); }

.scroll { flex: 1; min-height: 0; overflow: auto; padding: 2px 2px 8px; }
.state { text-align: center; color: var(--slate-500); font-size: 13px; line-height: 1.8; padding: 64px 0; }
.state small { font-size: 12px; color: var(--slate-400); }
.tbl { width: 100%; border-collapse: separate; border-spacing: 0 6px; font-size: 13px; }
.tbl th { text-align: left; font-size: 11px; font-weight: 700; color: var(--slate-500); padding: 0 12px 4px; white-space: nowrap; }
.tbl td { padding: 10px 12px; background: #fff; border-top: 1px solid var(--slate-100); border-bottom: 1px solid var(--slate-100); white-space: nowrap; }
.tbl tbody tr { cursor: pointer; }
.tbl tr.sel td { background: var(--blue-50); border-color: var(--blue-100); }
.ck { width: 36px; padding-right: 0 !important; }
.ck input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--blue-600); }
.selbar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 0 0 10px; padding: 8px 14px; border-radius: var(--radius-md); background: var(--blue-50); border: 1px solid var(--blue-100); font-size: 13px; color: var(--slate-700); }
.selbar b { color: var(--blue-700); }
.selbar__act { display: flex; gap: 8px; }
.tbl td:first-child { border-left: 1px solid var(--slate-100); border-radius: var(--radius-md) 0 0 var(--radius-md); }
.tbl td:last-child { border-right: 1px solid var(--slate-100); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
.tbl small { color: var(--slate-500); font-size: 11px; }
.r { text-align: right !important; }
.pill { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; background: var(--slate-100); color: var(--slate-700); }
.pill.ok { background: var(--amber-50); color: var(--amber-700); }
.pill.neg { background: var(--red-50); color: var(--red-700); }
.act { display: flex; gap: 4px; justify-content: flex-end; }
.act button { width: 30px; height: 30px; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--slate-500); }
.act button:hover { background: var(--slate-100); color: var(--slate-800); }
.foot { flex: none; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(226, 232, 240, .8); }

.form { display: flex; flex-direction: column; gap: 12px; }
.form h3 { font-size: 13px; font-weight: 800; color: var(--blue-700); margin-top: 6px; }
.form h3 small { font-weight: 500; font-size: 11px; color: var(--slate-500); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.f { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--slate-800); }
.f input.bad { border-color: #dc2626; background: var(--red-50); }
.hint { font-size: 12px; color: var(--slate-500); margin-top: -4px; }
.result { margin-top: 6px; padding: 14px 16px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 2px; background: var(--slate-50); border: 1px dashed var(--slate-300); }
.result small { font-size: 12px; font-weight: 700; color: var(--slate-600); }
.result b { font-size: 30px; font-weight: 800; line-height: 1.2; color: var(--blue-700); }
.result span { font-size: 12px; color: var(--slate-600); }
.result.ok { background: var(--blue-50); border: 1px solid var(--blue-100); }
.result.neg { background: var(--red-50); border: 1px solid #fecaca; }
.result.neg b { color: var(--red-700); }
.warn { color: var(--red-700) !important; font-weight: 600; }
.confirm { font-size: 13px; line-height: 1.7; color: var(--slate-700); }
@media (max-width: 900px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 700px) { .tp { padding: 16px; } .row { grid-template-columns: 1fr; } h1 { font-size: 21px; } }
.ptag { padding: 1px 8px; border-radius: 9999px; background: var(--amber-50); color: var(--amber-700); font-size: 10px; font-weight: 700; }
.pt { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); width: fit-content; }
.pt button { padding: 7px 16px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); }
.pt button.on { background: #fff; color: var(--blue-700); font-weight: 700; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.tiles--stock { margin-bottom: 8px; }
.tile--day, .tile--night { text-decoration: none; color: inherit; border-left: 4px solid #2563eb; } .tile--night { border-left-color: #7c3aed; }
.tile em { display: block; font-style: normal; font-size: 11px; color: var(--slate-500); margin-top: 2px; }
.srcs { max-width: 180px; } .schip { display: inline-block; margin: 1px 3px 1px 0; padding: 1px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #f0fdf4; color: #15803d; border: 1px solid #86efac; } .schip.old { background: #f5f3ff; color: #6d28d9; border-color: #c4b5fd; }
.muted { color: var(--slate-400); }
</style>

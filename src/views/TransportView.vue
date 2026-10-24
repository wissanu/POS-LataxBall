<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseModal from '@/components/BaseModal.vue'
import Pagination from '@/components/Pagination.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { transportService } from '@/services/transportService'
import { getErrorMessage } from '@/services/http'
import { bangkokDate, addDays, formatThaiDate } from '@/utils/dates'
import { formatKg, formatNumber, sanitizeDecimal, toNumber } from '@/utils/format'
import { calcLoss, durationMinutes, formatDuration } from '@/utils/transport'

const PAGE_SIZE = 10
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('purchase.create'))

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
const summary = computed(() => data.value?.summary)

// ---- ฟอร์ม (เพิ่ม/แก้ไข) ----
const blank = () => ({ date: bangkokDate(), shippedKg: '', departAt: '', billAt: '', factoryNetKg: '', note: '' })
const open = ref(false)
const editing = ref(null) // Trip | null
const form = reactive(blank())
const touched = ref(false)
const saving = ref(false)

function openNew() { editing.value = null; Object.assign(form, blank()); touched.value = false; open.value = true }
function openEdit(t) {
  editing.value = t
  Object.assign(form, { date: t.date, shippedKg: String(t.shippedKg), departAt: t.departAt, billAt: t.billAt, factoryNetKg: String(t.factoryNetKg), note: t.note ?? '' })
  touched.value = false
  open.value = true
}

// เวลาแบบ HH:mm — พิมพ์ได้ทั้ง 1430 / 14:30 / 14.30
function fmtTime(v) {
  const d = String(v).replace(/[^\d]/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}

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
  const payload = { date: form.date, shippedKg: toNumber(form.shippedKg), departAt: form.departAt, billAt: form.billAt, factoryNetKg: toNumber(form.factoryNetKg), note: form.note.trim() || undefined }
  try {
    if (editing.value) await transportService.update(editing.value.id, payload)
    else await transportService.create(payload)
    toast.success('บันทึกเที่ยวขนส่งแล้ว')
    open.value = false
    await load()
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
    toast.success('ลบเที่ยวขนส่งแล้ว')
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
        <BaseButton v-if="canEdit" @click="openNew"><AppIcon name="plus" :size="14" /> เพิ่มเที่ยวขนส่ง</BaseButton>
      </div>
    </header>

    <div v-if="summary" class="tiles">
      <div class="tile"><small>จำนวนเที่ยว</small><b>{{ summary.trips }}</b></div>
      <div class="tile"><small>น้ำหนักที่ส่งรวม</small><b>{{ formatKg(summary.shippedKg) }}</b></div>
      <div class="tile"><small>โรงงานชั่งได้รวม</small><b>{{ formatKg(summary.factoryNetKg) }}</b></div>
      <div class="tile tile--hi"><small>สูญเสียน้ำเฉลี่ยรวม</small><b>{{ pctText(summary.lossPct) }}</b><em>{{ formatKg(summary.lossKg) }}</em></div>
    </div>

    <div class="scroll">
      <p v-if="loading && !data" class="state">กำลังโหลด…</p>
      <p v-else-if="!trips.length" class="state">ยังไม่มีการขนส่งในช่วงนี้<br /><small>กด "เพิ่มเที่ยวขนส่ง" เพื่อบันทึกเที่ยวแรก</small></p>
      <table v-else class="tbl" :aria-busy="loading">
        <thead>
          <tr>
            <th>วันที่ / เที่ยว</th><th class="r">น้ำหนักที่ส่ง</th><th>ออกเดินทาง</th><th>รับบิลโรงงาน</th><th>ระยะเวลา</th>
            <th class="r">โรงงานชั่งได้</th><th class="r">สูญเสีย (กก.)</th><th class="r">สูญเสียน้ำ</th><th class="r">%/ชม.</th><th v-if="canEdit" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in trips" :key="t.id">
            <td><b>{{ formatThaiDate(t.date) }}</b><br /><small>เที่ยวที่ {{ t.tripNo }}</small></td>
            <td class="r">{{ formatKg(t.shippedKg) }}</td>
            <td>{{ t.departAt }} น.</td>
            <td>{{ t.billAt }} น.</td>
            <td>{{ formatDuration(t.durationMin) }}</td>
            <td class="r">{{ formatKg(t.factoryNetKg) }}</td>
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

    <BaseModal v-model="open" :title="editing ? 'แก้ไขเที่ยวขนส่ง' : 'เพิ่มเที่ยวขนส่ง'" width="560px">
      <div class="form">
        <label class="f"><span>วันที่ขนส่ง</span><input v-model="form.date" type="date" :class="{ bad: err('date') }" /></label>

        <h3>1) น้ำหนักยางก้อนถ้วยที่ขนส่ง</h3>
        <BaseInput v-model="form.shippedKg" label="น้ำหนักที่ส่ง (กก.)" inputmode="decimal" placeholder="เช่น 5200" :format="(v) => sanitizeDecimal(v, 2)" :error="err('shippedKg')" />

        <h3>2) ระยะเวลาขนส่ง</h3>
        <div class="row">
          <BaseInput v-model="form.departAt" label="ออกเดินทางกี่โมง" inputmode="numeric" placeholder="08:30" :maxlength="5" :format="fmtTime" :error="err('departAt')" />
          <BaseInput v-model="form.billAt" label="ได้รับบิลจากโรงงานกี่โมง" inputmode="numeric" placeholder="14:30" :maxlength="5" :format="fmtTime" :error="err('billAt')" />
        </div>
        <p class="hint">ระยะเวลา: <b>{{ formatDuration(minutes) }}</b><template v-if="minutes != null"> (เวลารับบิลน้อยกว่าเวลาออก = ข้ามเที่ยงคืน)</template></p>

        <h3>3) น้ำหนักสุทธิที่โรงงานชั่งได้</h3>
        <BaseInput v-model="form.factoryNetKg" label="น้ำหนักสุทธิ (กก.)" inputmode="decimal" placeholder="เช่น 5000" :format="(v) => sanitizeDecimal(v, 2)" :error="err('factoryNetKg')" />

        <BaseInput v-model="form.note" label="หมายเหตุ (ถ้ามี)" placeholder="เช่น ทะเบียนรถ / ชื่อโรงงาน" :maxlength="200" />

        <div class="result" :class="loss ? tone(loss.pct) : 'idle'" aria-live="polite">
          <template v-if="loss">
            <small>4) อัตราการสูญเสียน้ำ</small>
            <b>{{ pctText(loss.pct) }}</b>
            <span>สูญเสีย {{ formatKg(loss.lossKg) }} จาก {{ formatKg(toNumber(form.shippedKg)) }}<template v-if="loss.perHour != null"> · เฉลี่ย {{ pctText(loss.perHour) }} ต่อชั่วโมง</template></span>
            <span v-if="loss.pct < 0" class="warn">โรงงานชั่งได้มากกว่าที่ส่ง — ตรวจสอบตัวเลขอีกครั้ง</span>
          </template>
          <template v-else><small>4) อัตราการสูญเสียน้ำ</small><span>กรอกน้ำหนักข้อ 1 และข้อ 3 เพื่อดูผลลัพธ์</span></template>
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

.tiles { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
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
</style>

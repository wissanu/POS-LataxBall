<script setup>
// สรุปกำไร (หน้า "บิล") — เฉพาะผู้จัดการ/ผู้ดูแลระบบ (สิทธิ์เดียวกับเมนู "การขนส่ง") · แท็บ สรุปยอดวันนี้ + สรุปยอดงบดุล
//   รายรับ  = ยอดบิลโรงงานของเที่ยวขนส่งในวันนั้น          (กรอกที่เมนู "การขนส่ง")
//   รายจ่าย = ซื้อยางจากลูกค้า (อัตโนมัติ) + ค่าคนงาน + ค่าขนส่ง + อื่น ๆ   (3 ช่องหลังกรอกที่นี่)
//   กำไรสุทธิ = รายรับ − รายจ่าย · ยังไม่มีบิลโรงงาน = ยังบอกกำไรไม่ได้ (แสดงต้นทุนของวันไว้ก่อน)
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'
import RangeProfitPanel from './RangeProfitPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useOrderStore } from '@/stores/orders'
import { useToast } from '@/composables/useToast'
import { financeService } from '@/services/financeService'
import { getErrorMessage } from '@/services/http'
import { bangkokDate, formatThaiDate } from '@/utils/dates'
import { calcProfit, lossPctOf } from '@/utils/finance'
import { formatKg, formatMoney, formatNumber, round2, sanitizeDecimal, toNumber } from '@/utils/format'

const auth = useAuthStore()
const orders = useOrderStore()
const toast = useToast()
const visible = computed(() => auth.can('transport.read'))
const canEdit = computed(() => auth.can('transport.create'))

const today = bangkokDate()
const date = ref(today)
const props = defineProps({ defaultOpen: { type: Boolean, default: false }, balanceOnly: { type: Boolean, default: false } }) // balanceOnly = แสดงเฉพาะสรุปยอดงบดุล (ภาพรวม) ไม่มีแท็บสรุปยอดวันนี้
const open = ref(props.defaultOpen) // ย่ออยู่ก่อนเป็นค่าเริ่มต้น (เห็นแค่หัวแผง + กำไรสุทธิสั้น ๆ) · หน้า "บิล" เปิดไว้
const tab = ref(props.balanceOnly ? 'range' : 'day') // 'day' = สรุปยอดวันนี้ · 'range' = สรุปยอดงบดุล
const data = ref(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const exp = reactive({ labor: '', transport: '', other: '' }) // ช่องกรอก (string)
const saved = reactive({ labor: '', transport: '', other: '' }) // ค่าที่บันทึกล่าสุดจาก server
let req = 0

const str = (n) => (toNumber(n) ? String(n) : '')
const dirty = computed(() => ['labor', 'transport', 'other'].some((k) => toNumber(exp[k]) !== toNumber(saved[k])))

async function load({ force = false } = {}) {
  if (!visible.value) return
  const id = ++req
  loading.value = !data.value
  error.value = ''
  try {
    const res = await financeService.daily(date.value)
    if (id !== req) return
    data.value = res
    Object.assign(saved, { labor: str(res.laborCost), transport: str(res.transportCost), other: str(res.otherCost) })
    if (force || !dirty.value) Object.assign(exp, saved) // ระหว่างกรอกอยู่ ไม่ทับตัวเลขที่พิมพ์ค้างไว้
  } catch (e) {
    if (id === req) error.value = getErrorMessage(e, 'โหลดสรุปกำไรไม่สำเร็จ')
  } finally {
    if (id === req) loading.value = false
  }
}
onMounted(() => load({ force: true }))
watch(date, () => { data.value = null; load({ force: true }) })
// ใบรับซื้อเปลี่ยนสถานะ/เพิ่มใหม่ (store โพลอยู่แล้ว) → ดึงยอดซื้อใหม่
watch(() => orders.queue.map((c) => `${c.id}:${c.status}`).join(','), () => load())

const num = (k) => (e) => { exp[k] = sanitizeDecimal(e.target.value, 2); e.target.value = exp[k] }

async function save() {
  saving.value = true
  try {
    const res = await financeService.saveExpenses(date.value, { laborCost: toNumber(exp.labor), transportCost: toNumber(exp.transport), otherCost: toNumber(exp.other) })
    data.value = { ...data.value, ...res }
    Object.assign(saved, { labor: str(res.laborCost), transport: str(res.transportCost), other: str(res.otherCost) })
    Object.assign(exp, saved)
    toast.success('บันทึกค่าใช้จ่ายของวันที่ ' + formatThaiDate(date.value) + ' แล้ว')
  } catch (e) {
    toast.error(getErrorMessage(e, 'บันทึกค่าใช้จ่ายไม่สำเร็จ'))
  } finally {
    saving.value = false
  }
}

const hasBill = computed(() => (data.value?.billTrips ?? 0) > 0)
const calc = computed(() => calcProfit({ revenue: data.value?.revenue, purchase: data.value?.purchaseTotal, labor: exp.labor, transport: exp.transport, other: exp.other }))
const lossPct = computed(() => lossPctOf(data.value?.shippedKg, data.value?.factoryNetKg))
const perKg = computed(() => (hasBill.value && toNumber(data.value?.factoryNetKg) > 0 ? round2(calc.value.profit / toNumber(data.value.factoryNetKg)) : null))
const missingBills = computed(() => Math.max(0, (data.value?.trips ?? 0) - (data.value?.billTrips ?? 0)))
const isToday = computed(() => date.value === today)
</script>

<template>
  <section v-if="visible" class="dp" aria-label="สรุปกำไร">
    <header class="dp__head">
      <button type="button" class="dp__toggle" :aria-expanded="open" @click="open = !open">
        <AppIcon name="chart" :size="15" />
        <b>{{ balanceOnly ? 'สรุปยอดงบดุล (ภาพรวม)' : 'สรุปกำไร' }}</b>
        <span v-if="!balanceOnly" class="dp__date">{{ formatThaiDate(date) }}<template v-if="isToday"> (วันนี้)</template></span>
      </button>
      <span v-if="!balanceOnly" class="dp__quick" :class="{ loss: hasBill && calc.profit < 0, wait: !hasBill }">
        <template v-if="!data">…</template>
        <template v-else-if="hasBill">กำไรสุทธิ <b>{{ formatMoney(calc.profit) }}</b></template>
        <template v-else>รอบิลโรงงาน</template>
      </span>
      <label v-if="!balanceOnly" class="dp__pick"><span class="sr-only">เลือกวันที่</span><input v-model="date" type="date" :max="today" /></label>
    </header>

    <div v-if="open" class="dp__body">
      <div v-if="!balanceOnly" class="dp__tabs" role="tablist" aria-label="มุมมองสรุปกำไร">
        <button type="button" role="tab" :aria-selected="tab === 'day'" :class="{ on: tab === 'day' }" @click="tab = 'day'">สรุปยอดวันนี้</button>
        <button type="button" role="tab" :aria-selected="tab === 'range'" :class="{ on: tab === 'range' }" @click="tab = 'range'">สรุปยอดงบดุล</button>
      </div>

      <RangeProfitPanel v-if="tab === 'range'" />

      <template v-else>
      <p v-if="error" class="dp__err" role="alert">{{ error }} <button type="button" @click="load({ force: true })">ลองใหม่</button></p>

      <div class="dp__grid" :class="{ busy: loading }">
        <!-- รายรับ -->
        <div class="col col--in">
          <h3>รายรับ <small>ขายให้โรงงาน</small></h3>
          <p class="big">{{ hasBill ? formatMoney(calc.revenue) : '—' }}</p>
          <p class="sub">
            <template v-if="!data">กำลังโหลด…</template>
            <template v-else-if="!data.trips">ยังไม่มีเที่ยวขนส่งของวันนี้ (บันทึกที่เมนู “การขนส่ง”)</template>
            <template v-else>{{ data.billTrips }}/{{ data.trips }} เที่ยวมียอดบิลโรงงาน · โรงงานชั่งได้ {{ formatKg(data.factoryNetKg) }}</template>
          </p>
          <p v-if="missingBills" class="warn">มี {{ missingBills }} เที่ยวที่ยังไม่กรอกยอดบิลโรงงาน — รายรับอาจต่ำกว่าจริง</p>
        </div>

        <!-- รายจ่าย -->
        <div class="col col--out">
          <h3>รายจ่าย</h3>
          <dl class="lines">
            <div><dt>ซื้อยางจากลูกค้า <small>{{ data?.bills ?? 0 }} ใบ · {{ formatKg(data?.purchaseKg ?? 0) }}</small></dt><dd>{{ formatMoney(data?.purchaseTotal ?? 0) }}</dd></div>
            <div>
              <dt><label for="dp-labor">ค่าคนงาน</label></dt>
              <dd class="in"><input id="dp-labor" :value="exp.labor" inputmode="decimal" placeholder="0.00" maxlength="12" :disabled="!canEdit" @input="num('labor')($event)" /><em>บาท</em></dd>
            </div>
            <div>
              <dt><label for="dp-trans">ค่าขนส่ง / น้ำมัน</label></dt>
              <dd class="in"><input id="dp-trans" :value="exp.transport" inputmode="decimal" placeholder="0.00" maxlength="12" :disabled="!canEdit" @input="num('transport')($event)" /><em>บาท</em></dd>
            </div>
            <div>
              <dt><label for="dp-other">อื่น ๆ</label></dt>
              <dd class="in"><input id="dp-other" :value="exp.other" inputmode="decimal" placeholder="0.00" maxlength="12" :disabled="!canEdit" @input="num('other')($event)" /><em>บาท</em></dd>
            </div>
          </dl>
          <p class="total">รวมรายจ่าย <b>{{ formatMoney(calc.expense) }}</b></p>
        </div>

        <!-- กำไร -->
        <div class="col col--net" :class="{ loss: hasBill && calc.profit < 0, wait: !hasBill }">
          <h3>กำไรสุทธิ <small>หลังหักค่าคนงานและค่าใช้จ่าย</small></h3>
          <p class="big">{{ hasBill ? formatMoney(calc.profit) : '—' }}</p>
          <p class="sub">
            <template v-if="hasBill">
              <template v-if="calc.margin != null">อัตรากำไร {{ formatNumber(calc.margin) }}% ของรายรับ</template>
              <template v-if="perKg != null"> · {{ formatMoney(perKg) }} / กก.</template>
            </template>
            <template v-else>ยังไม่มีบิลโรงงาน — ต้นทุนวันนี้ {{ formatMoney(calc.expense) }}</template>
          </p>
          <p v-if="lossPct != null" class="loss-line">น้ำหายระหว่างขนส่ง <b>{{ formatNumber(lossPct) }}%</b> <small>({{ formatKg(data.shippedKg) }} → {{ formatKg(data.factoryNetKg) }})</small></p>
          <BaseButton v-if="canEdit" size="sm" :loading="saving" :disabled="!dirty" class="save" @click="save"><AppIcon name="check" :size="14" /> บันทึกค่าใช้จ่าย</BaseButton>
        </div>
      </div>

      <p class="dp__note">แท็บนี้คิดแบบเงินสดตามวันที่เกิดรายการ: ยางที่ซื้อวันนี้แต่ส่งขายพรุ่งนี้ จะเห็นเป็นต้นทุนของวันนี้และรายรับของพรุ่งนี้ — ถ้าขายยางค้างคืนหรือขายบางส่วน ให้ดูที่แท็บ “สรุปยอดงบดุล” ซึ่งคิดกำไรตามต้นทุนยางที่ขายไปจริง</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.dp { flex: none; margin-top: 14px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-200); }
.dp__head { display: flex; align-items: center; gap: 12px; padding: 8px 12px; flex-wrap: wrap; }
.dp__toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--slate-800); }
.dp__toggle b { font-weight: 800; }
.dp__date { font-size: 12px; color: var(--slate-500); }
.dp__quick { margin-left: auto; font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 9999px; background: var(--blue-50); color: var(--blue-700); }
.dp__quick.loss { background: var(--red-50); color: var(--red-700); }
.dp__quick.wait { background: var(--slate-100); color: var(--slate-500); }
.dp__quick b { font-weight: 800; }
.dp__pick input { height: 32px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: 10px; font: inherit; font-size: 12px; color: var(--slate-800); background: #fff; }
.dp__tabs { display: inline-flex; gap: 2px; margin-top: 10px; padding: 3px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); }
.dp__tabs button { padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-500); }
.dp__tabs button.on { background: #fff; color: var(--blue-700); font-weight: 700; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.dp__body { padding: 4px 12px 12px; border-top: 1px solid var(--slate-100); }
.dp__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1fr); gap: 12px; margin-top: 10px; transition: opacity .15s; }
.dp__grid.busy { opacity: .6; }
.col { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--slate-100); background: var(--slate-50); }
.col h3 { font-size: 12px; font-weight: 800; color: var(--slate-700); }
.col h3 small { font-weight: 500; color: var(--slate-400); margin-left: 4px; }
.col--in { border-left: 4px solid #16a34a; } .col--out { border-left: 4px solid #d97706; } .col--net { border-left: 4px solid var(--blue-600); background: var(--blue-50); }
.col--net.loss { border-left-color: #dc2626; background: var(--red-50); } .col--net.wait { background: var(--slate-50); border-left-color: var(--slate-300); }
.big { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 1.2; }
.col--net .big { color: var(--blue-700); } .col--net.loss .big { color: var(--red-700); } .col--net.wait .big { color: var(--slate-400); }
.sub { font-size: 11px; line-height: 1.5; color: var(--slate-500); }
.warn { font-size: 11px; font-weight: 600; color: var(--amber-700); }
.loss-line { font-size: 12px; color: var(--slate-700); } .loss-line small { color: var(--slate-400); }
.lines { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.lines > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.lines dt { color: var(--slate-600); } .lines dt small { display: block; font-size: 10px; color: var(--slate-400); }
.lines dd { margin: 0; font-weight: 700; color: var(--slate-900); font-variant-numeric: tabular-nums; }
.lines dd.in { position: relative; }
.lines input { width: 132px; height: 32px; padding: 0 34px 0 10px; text-align: right; font: inherit; font-size: 13px; font-weight: 700; color: var(--slate-900); border: 1px solid var(--slate-300); border-radius: 10px; background: #fff; outline: none; }
.lines input:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.lines input:disabled { background: var(--slate-100); color: var(--slate-500); }
.lines input::placeholder { color: var(--slate-300); font-weight: 500; }
.lines em { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 10px; color: var(--slate-400); pointer-events: none; }
.total { margin-top: 2px; padding-top: 6px; border-top: 1px dashed var(--slate-300); font-size: 12px; color: var(--slate-600); display: flex; justify-content: space-between; }
.total b { font-size: 14px; color: var(--slate-900); }
.save { align-self: flex-start; margin-top: 6px; }
.dp__note { margin-top: 10px; font-size: 11px; line-height: 1.6; color: var(--slate-400); }
.dp__err { font-size: 12px; color: #dc2626; padding-top: 8px; } .dp__err button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
@media (max-width: 1100px) { .dp__grid { grid-template-columns: 1fr; } .dp__quick { margin-left: 0; } }
</style>

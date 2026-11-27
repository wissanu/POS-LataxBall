<script setup>
// แถบใต้ปุ่มด้านบนของหน้า "รับออเดอร์ใหม่":
//   1) ราคาโรงงาน ณ วันที่ลงบิล (ผู้ใช้กำหนดเอง · บาท/กก. ยางแห้ง DRC 100%) — ยังไม่กำหนด = Bill & Print จะแจ้งเตือนและหยุดไว้ก่อน
//   2) แผงคาดการณ์ (ราคาที่รับซื้อ · DRC% คาดการณ์ · กำไร/กก. · กำไรสุทธิคาดการณ์) — โผล่เมื่อมีน้ำหนักในตะกร้า + ระบุชื่อลูกค้าแล้ว เพื่อตัดสินใจก่อนกด Bill & Print
import { computed, nextTick, ref, watch } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useFactoryDayStore } from '@/stores/factoryDay'
import { usePriceBoardStore } from '@/stores/priceBoard'
import { orderService } from '@/services/orderService'
import { useToast } from '@/composables/useToast'
import { formatMoney, formatNumber, round2, sanitizeDecimal, toNumber } from '@/utils/format'

const cart = useCartStore()
const auth = useAuthStore()
const day = useFactoryDayStore()
const board = usePriceBoardStore()
const toast = useToast()

const canSet = computed(() => auth.can('price.manage'))
const date = computed(() => board.selectedDate || board.todayStr)
const input = ref('')
const inputEl = ref(null)
const pulse = ref(false)

watch(date, (d) => day.load(d), { immediate: true })
watch(() => day.price, (p) => { input.value = p == null ? '' : String(p) }, { immediate: true })
watch(() => day.focusTick, async () => {
  pulse.value = true
  await nextTick()
  inputEl.value?.focus(); inputEl.value?.select()
  setTimeout(() => { pulse.value = false }, 2200)
})

const dirty = computed(() => toNumber(input.value) !== (day.price ?? 0) && !(input.value === '' && day.price == null))
function onInput(e) { input.value = sanitizeDecimal(e.target.value, 2); e.target.value = input.value }
async function save() {
  const v = toNumber(input.value)
  if (input.value === '') { if (day.price != null && (await day.save(null))) toast.info('ล้างราคาโรงงานแล้ว'); return }
  if (!(v >= 20 && v <= 300)) return toast.error('ราคาโรงงานต้องอยู่ระหว่าง 20 - 300 บาท/กก.')
  if (await day.save(v)) toast.success(`กำหนดราคาโรงงาน ${formatNumber(v)} บาท/กก. แล้ว`)
  else toast.error(day.error)
}
async function useSuggestion() { input.value = String(day.suggestion); await save() }

// ---- แผงคาดการณ์ ----
const customerReady = computed(() => (cart.customerType === 'member' ? !!cart.member : !!cart.cleanName))
const cupLines = computed(() => cart.lines.filter((l) => (l.productType ?? 'CUP_LUMP') !== 'FOAM' && cart.netOf(l) > 0))
const hasFoam = computed(() => cart.lines.some((l) => l.productType === 'FOAM'))
const show = computed(() => cupLines.value.length > 0 && customerReady.value)

const est = ref(null)
const estError = ref('')
let timer = null; let req = 0
async function fetchEst() {
  const id = ++req
  try {
    const r = await orderService.estimate({ customer: cart.customer, ...(board.isBackdated ? { billDate: board.date } : {}), ...(cart.dryness ? { dryness: cart.dryness } : {}), ...(cart.porosity ? { porosity: cart.porosity } : {}), ...(cart.knifeCount ? { knifeCount: cart.knifeCount } : {}) })
    if (id === req) { est.value = r; estError.value = '' }
  } catch { if (id === req) { est.value = null; estError.value = 'คาดการณ์ DRC ไม่สำเร็จ' } }
}
watch(() => [show.value, cart.customerType, cart.memberId, cart.cleanName, cart.dryness, cart.porosity, cart.knifeCount, date.value], () => {
  clearTimeout(timer)
  if (!show.value) { est.value = null; return }
  timer = setTimeout(fetchEst, 350)
}, { immediate: true })

const calc = computed(() => {
  const kg = round2(cupLines.value.reduce((a, l) => a + cart.netOf(l), 0))
  const sub = cupLines.value.reduce((a, l) => a + cart.amountOf(l), 0)
  const ratio = cart.subtotal > 0 ? cart.total / cart.subtotal : 1 // รวมเพิ่มราคา/ส่วนแบ่งสวน เหมือนต้นทุนที่ระบบเก็บ
  const cost = round2(sub * ratio)
  const buy = kg > 0 ? cost / kg : 0
  const y = est.value?.drcPct ?? null
  const P = day.price
  const perKg = y != null && P != null ? (P * y) / 100 - buy : null
  return { kg, cost, buy, y, P, perKg, net: perKg == null ? null : round2(perKg * kg) }
})
const BASIS = { CUSTOMER: 'ตามประวัติของลูกค้าคนนี้', SHOP: 'ลูกค้าใหม่/ข้อมูลน้อย — ใช้ค่าเฉลี่ยร้าน' }
const CONF = { none: 'ยังไม่มีประวัติ', low: 'ข้อมูลน้อย', mid: 'พอใช้', high: 'น่าเชื่อถือ' }
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${formatMoney(v)}`)
</script>

<template>
  <section class="fs" aria-label="ราคาโรงงานและคาดการณ์กำไร">
    <div class="fs__price" :class="{ 'fs__price--pulse': pulse, 'fs__price--missing': day.loaded && day.price == null }">
      <label for="factory-price">ราคาโรงงาน <small>{{ board.isBackdated ? 'ของวันที่ลงบิล' : 'วันนี้' }} · บาท/กก. ยางแห้ง</small></label>
      <div class="fs__row">
        <input id="factory-price" ref="inputEl" :value="input" inputmode="decimal" maxlength="7" autocomplete="off" placeholder="เช่น 72.50" :disabled="!canSet || day.saving" :title="canSet ? undefined : 'ต้องมีสิทธิ์ตั้งราคา (ผู้จัดการ/ผู้ดูแลระบบ)'" @input="onInput" @keydown.enter.prevent="save" />
        <button type="button" class="fs__save" :disabled="!canSet || !dirty || day.saving" @click="save">{{ day.saving ? '…' : 'บันทึก' }}</button>
      </div>
      <p v-if="day.loaded && day.price == null" class="fs__warn">ยังไม่ได้กำหนดราคาโรงงาน<template v-if="day.suggestion != null"> · ระบบประเมิน <button type="button" class="fs__sug" :disabled="!canSet" @click="useSuggestion">ใช้ {{ formatNumber(day.suggestion) }}</button></template></p>
      <p v-else-if="day.error" class="fs__warn">{{ day.error }}</p>
    </div>

    <div v-if="show" class="fs__est" role="status" aria-live="polite">
      <div class="c"><small>ราคาที่รับซื้อ (เฉลี่ย)</small><b>{{ formatNumber(calc.buy) }}</b><span>บาท/กก. · {{ formatNumber(calc.kg) }} กก.</span></div>
      <div class="c"><small>DRC% (คาดการณ์)</small><b>{{ calc.y == null ? '—' : `${formatNumber(calc.y)}%` }}</b><span>{{ est ? `${BASIS[est.basis] ?? ''}${est.basis === 'CUSTOMER' ? ` · ${CONF[est.confidence]}` : ''}` : estError || 'กำลังคำนวณ…' }}</span></div>
      <div class="c" :class="{ neg: calc.perKg != null && calc.perKg < 0, pos: calc.perKg != null && calc.perKg >= 0 }"><small>กำไร/กก.</small><b>{{ signed(calc.perKg == null ? null : round2(calc.perKg)) }}</b><span>{{ calc.P == null ? 'กำหนดราคาโรงงานก่อน' : 'ราคาโรงงาน × DRC% − ราคารับซื้อ' }}</span></div>
      <div class="c" :class="{ neg: calc.net != null && calc.net < 0, pos: calc.net != null && calc.net >= 0 }"><small>กำไรสุทธิ (คาดการณ์)</small><b>{{ signed(calc.net) }}</b><span>{{ calc.net != null && calc.net < 0 ? 'ขาดทุน — ต่ำกว่าทุน' : 'บิลนี้ · ก่อนหักค่าแรง/ขนส่ง' }}{{ hasFoam ? ' · ไม่รวมขี้ฟอง' : '' }}</span></div>
    </div>
  </section>
</template>

<style scoped>
.fs { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: stretch; padding: 10px 0 0; }
.fs__price { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-200); min-width: 250px; }
.fs__price label { font-size: 12px; font-weight: 700; color: var(--slate-800); } .fs__price small { font-weight: 500; color: var(--slate-400); margin-left: 4px; }
.fs__price--missing { border-color: #fcd34d; background: var(--amber-50); }
.fs__price--pulse { animation: pulse 0.7s ease-in-out 3; border-color: #dc2626; }
@keyframes pulse { 50% { box-shadow: 0 0 0 4px rgba(220, 38, 38, .25); } }
@media (prefers-reduced-motion: reduce) { .fs__price--pulse { animation: none; } }
.fs__row { display: flex; gap: 6px; }
.fs__row input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--slate-200); border-radius: 9px; font: inherit; font-size: 15px; font-weight: 700; color: var(--slate-900); background: #fff; font-variant-numeric: tabular-nums; }
.fs__row input:disabled { background: var(--slate-50); color: var(--slate-500); }
.fs__save { height: 32px; padding: 0 12px; border-radius: 9px; background: var(--blue-600); color: #fff; font-size: 12px; font-weight: 700; } .fs__save:disabled { opacity: .4; cursor: not-allowed; }
.fs__warn { font-size: 11px; color: var(--amber-700); font-weight: 600; } .fs__sug { margin-left: 4px; text-decoration: underline; color: var(--blue-700); font-weight: 700; } .fs__sug:disabled { opacity: .5; }
.fs__est { flex: 1; min-width: 320px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.c { display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-100); border-left: 4px solid var(--slate-300); min-width: 0; }
.c small { font-size: 11px; font-weight: 700; color: var(--slate-600); } .c b { font-size: 18px; font-weight: 800; color: var(--slate-900); font-variant-numeric: tabular-nums; } .c span { font-size: 10.5px; color: var(--slate-500); line-height: 1.35; }
.c.pos { border-left-color: #16a34a; } .c.pos b { color: #15803d; } .c.neg { border-left-color: #dc2626; background: #fef2f2; } .c.neg b { color: #dc2626; }
@media (max-width: 900px) { .fs__est { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

<script setup>
// รอจัดการบิล — ยางที่ยังไม่ได้บิลโรงงาน แยกตาม "วันที่ซื้อยาง" (ย่อไว้ กดกางเอง)
//   โรงงานจ่ายบิลช้า (ขายวันที่ 10 ได้บิล/เงินวันที่ 12) → เห็นทันทีว่าวันไหนยังค้าง และจัดการให้ตรงวัน
//   กำลังจัดส่ง = อยู่ในฉบับร่างเที่ยวขนส่ง · รอจัดส่ง = ยังไม่เข้าฉบับร่าง · รอยอดบิล = บันทึกเที่ยวแล้ว แต่โรงงานยังไม่ส่งยอดเงิน
//   บิลที่ยังไม่ได้ขายคำนวณล่วงหน้า (ประมาณการ): รายรับ = ราคาโรงงานที่ประเมิน × เนื้อยางแห้งที่คาด (น้ำหนัก × DRC ตอนซื้อรายลูกค้า)
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { billsService } from '@/services/billsService'
import { financeService } from '@/services/financeService'
import { transportService } from '@/services/transportService'
import { getErrorMessage } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatThaiDate } from '@/utils/dates'
import { formatKg, formatMoney, formatNumber, round2, sanitizeDecimal, toNumber } from '@/utils/format'

const emit = defineEmits(['changed'])
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('transport.create'))

const data = ref(null)
const loading = ref(false)
const error = ref('')
const open = ref(new Set()) // วันที่กางอยู่ (ย่อเป็นค่าเริ่มต้น)
const exp = reactive({}) // date -> { labor, transport, other } (ช่องกรอก)
const bill = reactive({}) // tripId -> { drc, amount, saving }
const savingExp = ref('')
const confirming = ref('') // วันที่กำลังยืนยัน/เปิดใหม่

async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const res = await billsService.pending()
    data.value = res
    for (const d of res.days) {
      const e = d.expenses
      const cur = exp[d.date]
      const s = (n) => (n ? String(n) : '')
      if (!cur || !cur.dirty) exp[d.date] = { labor: s(e.labor), transport: s(e.transport), other: s(e.other), dirty: false }
      for (const t of d.awaiting?.trips ?? []) if (!bill[t.id]) bill[t.id] = { drc: t.drcPct != null ? String(t.drcPct) : '', amount: '', saving: false }
    }
  } catch (e) { error.value = getErrorMessage(e, 'โหลดรายการรอจัดการบิลไม่สำเร็จ') } finally { loading.value = false }
}
onMounted(() => { load(); document.addEventListener('visibilitychange', onVisible) })
const onVisible = () => { if (document.visibilityState === 'visible') load(true) }
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

const days = computed(() => data.value?.days ?? [])
const sum = computed(() => data.value?.summary)
const toggle = (d) => { const s = new Set(open.value); s.has(d) ? s.delete(d) : s.add(d); open.value = s }
const allOpen = computed(() => days.value.length > 0 && days.value.every((d) => open.value.has(d.date)))
const toggleAll = () => { open.value = allOpen.value ? new Set() : new Set(days.value.map((d) => d.date)) }

const ageText = (n) => (n <= 0 ? 'วันนี้' : n === 1 ? 'เมื่อวาน' : `${n} วันก่อน`)
const ageTone = (n) => (n >= 3 ? 'late' : n >= 2 ? 'warn' : 'ok')
const money = (v) => (v == null ? '—' : formatMoney(v))
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`)

const num = (date, k) => (e) => { exp[date][k] = sanitizeDecimal(e.target.value, 2); exp[date].dirty = true; e.target.value = exp[date][k] }
const expTotal = (d) => round2(toNumber(exp[d.date]?.labor) + toNumber(exp[d.date]?.transport) + toNumber(exp[d.date]?.other))
const netOf = (d) => (d.projection.gross == null ? null : round2(d.projection.gross - expTotal(d)))
async function saveExp(d) {
  savingExp.value = d.date
  try {
    const e = exp[d.date]
    await financeService.saveExpenses(d.date, { laborCost: toNumber(e.labor), transportCost: toNumber(e.transport), otherCost: toNumber(e.other) })
    e.dirty = false
    toast.success(`บันทึกค่าใช้จ่ายของวันที่ ${formatThaiDate(d.date)} แล้ว`)
    await load(true); emit('changed')
  } catch (err) { toast.error(getErrorMessage(err, 'บันทึกค่าใช้จ่ายไม่สำเร็จ')) } finally { savingExp.value = '' }
}

// ---- กรอกบิลโรงงานของเที่ยวที่รอยอดเงิน: DRC% + ยอดเงิน → ราคา/กก. ยางแห้ง คำนวณให้เอง ----
const priceOf = (t) => { const b = bill[t.id]; const d = toNumber(b?.drc), a = toNumber(b?.amount); return d > 0 && a > 0 && t.netKg > 0 ? round2(a / (t.netKg * (d / 100))) : null }
const diffOf = (t) => (t.estAmount != null && toNumber(bill[t.id]?.amount) > 0 ? round2(toNumber(bill[t.id].amount) - t.estAmount) : null)
const field = (t, k) => (e) => { bill[t.id][k] = sanitizeDecimal(e.target.value, 2); e.target.value = bill[t.id][k] }
async function saveBill(t) {
  const b = bill[t.id]
  if (!(toNumber(b.drc) > 0 && toNumber(b.drc) <= 100)) return toast.error('กรอก DRC% ตามบิลโรงงาน (1-100)')
  if (!(toNumber(b.amount) > 0)) return toast.error('กรอกยอดเงินตามบิลโรงงาน')
  b.saving = true
  try {
    await transportService.update(t.id, { factoryDrcPct: toNumber(b.drc), factoryAmount: toNumber(b.amount) })
    toast.success(`บันทึกบิล ${t.no} แล้ว`)
    delete bill[t.id]
    await load(true); emit('changed')
  } catch (err) { toast.error(getErrorMessage(err, 'บันทึกบิลไม่สำเร็จ')); b.saving = false }
}
// ---- ยืนยันเองว่าวันนี้เรียบร้อยแล้ว (จัดส่งเรียบร้อย + บิลโรงงานครบ) — ก่อนยืนยันวันนั้นค้างในรายการ จะได้กรอก/แก้ค่าใช้จ่ายให้เสร็จก่อน ----
const noExpense = (d) => expTotal(d) <= 0
async function confirmDay(d) {
  confirming.value = d.date
  try {
    if (exp[d.date]?.dirty) await saveExp(d) // ค่าที่พิมพ์ค้างไว้ บันทึกก่อนปิดวัน
    await billsService.confirmDay(d.date)
    toast.success(`ยืนยันวันที่ ${formatThaiDate(d.date)} เรียบร้อยแล้ว`)
    await load(true); emit('changed')
  } catch (err) { toast.error(getErrorMessage(err, 'ยืนยันไม่สำเร็จ')) } finally { confirming.value = '' }
}
async function reopenDay(date) {
  confirming.value = date
  try { await billsService.reopenDay(date); toast.success(`เปิดวันที่ ${formatThaiDate(date)} กลับมาแก้ไขแล้ว`); await load(true) }
  catch (err) { toast.error(getErrorMessage(err, 'เปิดใหม่ไม่สำเร็จ')) } finally { confirming.value = '' }
}
const confirmedRecent = computed(() => data.value?.confirmedRecent ?? [])
const openDraft = (id) => router.push({ name: 'transport', query: { draft: id } })
const unit = (l) => (l.pt === 'FOAM' ? 'ขี้ฟอง' : 'ก้อนถ้วย')
</script>

<template>
  <section class="pb" aria-label="รอจัดการบิล">
    <header class="pb__head">
      <div class="pb__title">
        <h2>รอจัดการบิล</h2>
        <p v-if="sum">
          <span class="c c--ship">กำลังจัดส่ง {{ sum.shippingBills }} ใบ</span>
          <span class="c">รอจัดส่ง {{ sum.waitingBills }} ใบ</span>
          <span class="c c--wait">รอยอดบิลโรงงาน {{ sum.awaitingTrips }} เที่ยว</span>
          <span v-if="sum.doneDays" class="c c--done">จัดส่งเรียบร้อย รอยืนยัน {{ sum.doneDays }} วัน</span>
          <span class="muted">· {{ sum.days }} วันที่ยังค้าง · ต้นทุน {{ formatMoney(sum.cost) }}<template v-if="sum.estRevenue != null"> · ประมาณการรายรับ {{ formatMoney(sum.estRevenue) }}</template></span>
        </p>
        <p v-else-if="loading" class="muted">กำลังโหลด…</p>
      </div>
      <button v-if="days.length" type="button" class="lnk" @click="toggleAll">{{ allOpen ? 'ย่อทั้งหมด' : 'กางทั้งหมด' }}</button>
      <button type="button" class="lnk" :disabled="loading" @click="load(true)">รีเฟรช</button>
    </header>

    <p v-if="data?.factoryPrice" class="pb__note">
      ประมาณการใช้ราคาโรงงาน <b>{{ formatNumber(data.factoryPrice.price) }}</b> บาท/กก.{{ data.factoryPrice.manual ? ' (ที่คุณแก้)' : ' (ประเมิน)' }}
      และ DRC ตอนซื้อรายลูกค้า ({{ data.model.customersWithData }} คนมีข้อมูล) — เป็นตัวเลขประมาณ ไม่ใช่ยอดบิลจริง จะถูกแทนที่เมื่อกรอกบิลโรงงาน
    </p>
    <p v-else-if="data" class="pb__note">ยังไม่มีราคาโรงงานสำหรับประมาณการ — ตั้งราคาที่หน้า “ประเมินราคา”</p>
    <p v-if="error" class="err" role="alert">{{ error }} <button type="button" @click="load()">ลองใหม่</button></p>
    <p v-if="data && !days.length" class="ok">ไม่มีบิลค้าง — ยางทุกวันขายได้ยอดบิลโรงงานครบและยืนยันเรียบร้อยแล้ว</p>
    <p v-if="confirmedRecent.length" class="pb__note">ยืนยันแล้ว (30 วันล่าสุด): <button v-for="c in confirmedRecent" :key="c.date" type="button" class="lnk lnk--chip" :disabled="!canEdit || confirming === c.date" :title="canEdit ? 'เปิดกลับมาแก้ไข' : ''" @click="reopenDay(c.date)">{{ formatThaiDate(c.date) }} ↺ เปิดใหม่</button></p>

    <ul class="days">
      <li v-for="d in days" :key="d.date" class="day" :class="`day--${ageTone(d.ageDays)}`">
        <button type="button" class="day__head" :aria-expanded="open.has(d.date)" @click="toggle(d.date)">
          <span class="chev" :class="{ up: open.has(d.date) }">▸</span>
          <b class="dt">{{ formatThaiDate(d.date) }}</b>
          <span class="age" :class="`age--${ageTone(d.ageDays)}`">{{ ageText(d.ageDays) }}</span>
          <span class="chips">
            <span v-if="d.shipping" class="c c--ship"><AppIcon name="truck" :size="11" /> กำลังจัดส่ง {{ d.shipping.bills }} ใบ · {{ formatKg(d.shipping.cupKg + d.shipping.foamKg) }}</span>
            <span v-if="d.waiting" class="c">รอจัดส่ง {{ d.waiting.bills }} ใบ · {{ formatKg(d.waiting.cupKg + d.waiting.foamKg) }}</span>
            <span v-if="d.awaiting" class="c c--wait">รอยอดบิล {{ d.awaiting.trips.length }} เที่ยว</span>
            <span v-if="d.done" class="c c--done"><AppIcon name="check" :size="11" /> จัดส่งเรียบร้อยแล้ว · รอยืนยัน</span>
          </span>
          <span class="n">ต้นทุน <b>{{ money(d.projection.cost) }}</b></span>
          <span class="n">รายรับ <em>{{ d.done ? 'ตามบิลโรงงาน' : 'ประมาณ' }}</em> <b>{{ money(d.projection.revenue) }}</b></span>
          <span class="n" :class="{ neg: netOf(d) != null && netOf(d) < 0 }">กำไรสุทธิ <em>{{ d.done ? 'จริง' : 'ประมาณ' }}</em> <b>{{ signed(netOf(d)) }}</b></span>
        </button>

        <div v-if="open.has(d.date)" class="day__body">
          <!-- เหมือนสรุปยอดวันนี้: รายรับ / รายจ่าย / กำไร (ของยางที่ยังไม่ได้บิลในวันนั้น) -->
          <div class="grid">
            <div class="col col--in">
              <h3>รายรับ <small>{{ d.done ? 'ตามบิลโรงงาน' : 'ประมาณการ' }}</small></h3>
              <p class="big">{{ money(d.projection.revenue) }}</p>
              <p v-if="d.done" class="sub">ยางของวันนี้ขายให้โรงงานครบแล้ว (บิลที่รวมหลายวัน แบ่งตามน้ำหนักของวันนี้)</p>
              <p v-else class="sub">ยางแห้งที่คาด {{ formatKg(d.projection.dryKg) }}<template v-if="data.factoryPrice"> × {{ formatNumber(data.factoryPrice.price) }} บาท/กก.</template></p>
              <p v-if="d.projection.partial" class="warn">ไม่นับขี้ฟอง หรือบางใบยังไม่มีข้อมูล DRC — รายรับอาจต่ำกว่าจริง</p>
            </div>
            <div class="col col--out">
              <h3>รายจ่าย</h3>
              <dl class="lines">
                <div><dt>ต้นทุนยางที่ยังไม่ได้บิล <small>ซื้อทั้งวัน {{ d.bought.bills }} ใบ · {{ formatKg(d.bought.cupKg + d.bought.foamKg) }} · {{ formatMoney(d.bought.cost) }}</small></dt><dd>{{ money(d.projection.cost) }}</dd></div>
                <div v-for="f in [{ k: 'labor', t: 'ค่าคนงาน' }, { k: 'transport', t: 'ค่าขนส่ง / น้ำมัน' }, { k: 'other', t: 'อื่น ๆ' }]" :key="f.k">
                  <dt><label :for="`e-${d.date}-${f.k}`">{{ f.t }}</label></dt>
                  <dd class="in"><input :id="`e-${d.date}-${f.k}`" :value="exp[d.date]?.[f.k]" inputmode="decimal" placeholder="0.00" maxlength="12" :disabled="!canEdit" @input="num(d.date, f.k)($event)" /><em>บาท</em></dd>
                </div>
              </dl>
              <p class="total">รวมรายจ่าย <b>{{ money(round2((d.projection.cost ?? 0) + expTotal(d))) }}</b></p>
            </div>
            <div class="col col--net" :class="{ loss: netOf(d) != null && netOf(d) < 0 }">
              <h3>กำไรสุทธิ <small>{{ d.done ? 'หลังหักค่าใช้จ่าย' : 'ประมาณการ หลังหักค่าใช้จ่าย' }}</small></h3>
              <p class="big">{{ signed(netOf(d)) }}</p>
              <p class="sub">กำไรขั้นต้น {{ signed(d.projection.gross) }} − ค่าใช้จ่าย {{ money(expTotal(d)) }}</p>
              <button v-if="canEdit" type="button" class="btn" :disabled="!exp[d.date]?.dirty || savingExp === d.date" @click="saveExp(d)">บันทึกค่าใช้จ่าย</button>
              <template v-if="d.done && canEdit">
                <p v-if="noExpense(d)" class="warn">ยังไม่ได้กรอกค่าคนงาน / ค่าขนส่ง / อื่น ๆ ของวันนี้</p>
                <button type="button" class="btn btn--ok" :disabled="confirming === d.date" @click="confirmDay(d)">{{ confirming === d.date ? '…' : '✓ ยืนยันเรียบร้อย' }}</button>
                <p class="sub">ตรวจต้นทุนและค่าใช้จ่ายแล้วกดยืนยัน วันนี้จะหายจากรายการนี้ (เปิดกลับมาแก้ได้ภายหลัง)</p>
              </template>
            </div>
          </div>

          <!-- จัดส่งเรียบร้อยแล้ว: บิลขายโรงงานที่อ้างถึงวันนี้ -->
          <div v-if="d.done" class="sec">
            <h4><AppIcon name="check" :size="13" /> จัดส่งเรียบร้อยแล้ว <small>บิลขายโรงงานที่ใช้ยางของวันนี้</small>
              <button type="button" class="lnk" @click="router.push({ name: 'transport' })">แก้ไขเที่ยว/บิลโรงงานที่หน้าการขนส่ง →</button></h4>
            <div class="scroll-x">
              <table class="tb">
                <thead><tr><th>บิลขาย</th><th>ขายวันที่</th><th class="r">น้ำหนักของวันนี้</th><th class="r">ต้นทุน</th><th class="r">DRC%</th><th class="r">รายรับส่วนของวันนี้</th></tr></thead>
                <tbody><tr v-for="t in d.sold" :key="t.id"><td>{{ t.no }}</td><td>{{ formatThaiDate(t.saleDate) }}</td><td class="r">{{ formatKg(t.kg) }}</td><td class="r">{{ formatMoney(t.cost) }}</td><td class="r">{{ t.drcPct == null ? '—' : formatNumber(t.drcPct) + '%' }}</td><td class="r">{{ money(t.revenue) }}</td></tr></tbody>
              </table>
            </div>
          </div>

          <!-- กำลังจัดส่ง -->
          <div v-if="d.shipping" class="sec">
            <h4><AppIcon name="truck" :size="13" /> กำลังจัดส่ง <small>อยู่ในฉบับร่างเที่ยวขนส่ง {{ d.shipping.drafts.length }} ฉบับ</small>
              <button v-for="(dr, i) in d.shipping.drafts" :key="dr.id" type="button" class="lnk" @click="openDraft(dr.id)">เปิดฉบับร่างที่ {{ i + 1 }} ({{ dr.bills }} ใบ · {{ formatKg(dr.kg) }}) เพื่อกรอกบิล →</button>
            </h4>
            <div class="scroll-x">
              <table class="tb">
                <thead><tr><th>ใบ</th><th>ลูกค้า</th><th class="r">น้ำหนัก</th><th class="r">ต้นทุน</th><th class="r">DRC ที่คาด</th><th class="r">ยางแห้งที่คาด</th></tr></thead>
                <tbody><tr v-for="l in d.shipping.lines" :key="l.id + l.pt"><td>{{ l.no }}</td><td>{{ l.customer }}</td><td class="r">{{ formatKg(l.kg) }} <small>{{ unit(l) }}</small></td><td class="r">{{ formatMoney(l.cost) }}</td><td class="r">{{ l.yPct == null ? '—' : formatNumber(l.yPct) + '%' }}</td><td class="r">{{ l.dryKg == null ? '—' : formatKg(l.dryKg) }}</td></tr></tbody>
              </table>
            </div>
          </div>

          <!-- รอจัดส่ง -->
          <div v-if="d.waiting" class="sec">
            <h4>รอจัดส่ง <small>ยังไม่เข้าฉบับร่าง · ขายต่อวัน {{ d.waiting.sameDay }} ใบ · ค้างคืน {{ d.waiting.overnight }} ใบ</small></h4>
            <div class="scroll-x">
              <table class="tb">
                <thead><tr><th>ใบ</th><th>ลูกค้า</th><th class="r">น้ำหนัก</th><th class="r">ต้นทุน</th><th class="r">DRC ที่คาด</th><th class="r">ยางแห้งที่คาด</th></tr></thead>
                <tbody><tr v-for="l in d.waiting.lines" :key="l.id + l.pt"><td>{{ l.no }}<span v-if="l.hold === 'OVERNIGHT'" class="c c--night">ค้างคืน</span></td><td>{{ l.customer }}</td><td class="r">{{ formatKg(l.kg) }} <small>{{ unit(l) }}</small></td><td class="r">{{ formatMoney(l.cost) }}</td><td class="r">{{ l.yPct == null ? '—' : formatNumber(l.yPct) + '%' }}</td><td class="r">{{ l.dryKg == null ? '—' : formatKg(l.dryKg) }}</td></tr></tbody>
              </table>
            </div>
          </div>

          <!-- ขายแล้ว รอยอดบิลโรงงาน -->
          <div v-if="d.awaiting" class="sec">
            <h4>รอยอดบิลโรงงาน <small>บันทึกเที่ยวแล้ว — กรอก DRC% และยอดเงินเมื่อโรงงานส่งบิล ระบบคำนวณราคา/กก. ให้</small></h4>
            <div v-for="t in d.awaiting.trips" :key="t.id" class="trip">
              <div class="trip__info">
                <b>{{ t.no }}</b> <small>ขาย {{ formatThaiDate(t.saleDate) }} · ชั่งได้ {{ formatKg(t.netKg) }} · ยางที่ซื้อวันนี้ {{ formatKg(t.kg) }} · ต้นทุน {{ formatMoney(t.cost) }}</small>
                <small class="est">ประมาณการยอดบิล {{ money(t.estAmount) }}<template v-if="t.drcPct != null"> (ตาม DRC {{ formatNumber(t.drcPct) }}% ที่กรอกไว้)</template></small>
              </div>
              <div v-if="canEdit && bill[t.id]" class="trip__form">
                <label>DRC% <input :value="bill[t.id].drc" inputmode="decimal" placeholder="เช่น 55" @input="field(t, 'drc')($event)" /></label>
                <label>ยอดเงินตามบิล <input :value="bill[t.id].amount" inputmode="decimal" placeholder="เช่น 24217" @input="field(t, 'amount')($event)" /></label>
                <span v-if="priceOf(t)" class="calc">= {{ formatNumber(priceOf(t)) }} บาท/กก. ยางแห้ง<template v-if="diffOf(t) != null"> · ต่างจากประมาณการ {{ signed(diffOf(t)) }}</template></span>
                <button type="button" class="btn" :disabled="bill[t.id].saving" @click="saveBill(t)">บันทึกบิล</button>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pb { flex: none; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-200); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.pb__head { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; } .pb__title { flex: 1; min-width: 260px; }
h2 { font-size: 16px; font-weight: 800; color: var(--slate-900); } .pb__title p { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; }
.muted { font-size: 12px; color: var(--slate-500); } .ok { font-size: 13px; color: var(--green-700); } .err { font-size: 13px; color: var(--red-700); } .err button { color: var(--blue-700); font-weight: 600; margin-left: 6px; }
.lnk { font-size: 12px; font-weight: 600; color: var(--blue-700); } .lnk:hover { text-decoration: underline; } .lnk:disabled { opacity: .5; }
.pb__note { font-size: 11.5px; line-height: 1.6; color: var(--slate-500); }
.c { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: var(--slate-100); color: var(--slate-600); white-space: nowrap; }
.c--ship { background: var(--blue-50); color: var(--blue-700); } .c--wait { background: #fffbeb; color: #b45309; } .c--done { background: var(--green-50); color: var(--green-700); } .lnk--chip { margin: 0 8px 0 0; padding: 1px 8px; border-radius: 9999px; background: var(--slate-100); }
.btn--ok { background: #16a34a; margin-top: 8px; }
.c--night { background: #eef2ff; color: #4338ca; margin-left: 6px; }
.days { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.day { border: 1px solid var(--slate-200); border-left-width: 4px; border-radius: var(--radius-md); background: #fff; }
.day--ok { border-left-color: #16a34a; } .day--warn { border-left-color: #d97706; } .day--late { border-left-color: #dc2626; }
.day__head { width: 100%; display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 9px 12px; text-align: left; font-size: 12.5px; color: var(--slate-700); }
.chev { display: inline-block; transition: transform .15s; color: var(--slate-500); } .chev.up { transform: rotate(90deg); }
.dt { font-size: 14px; color: var(--slate-900); font-weight: 800; }
.age { padding: 2px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; } .age--ok { background: var(--green-50); color: var(--green-700); } .age--warn { background: #fffbeb; color: #b45309; } .age--late { background: var(--red-50); color: var(--red-700); }
.chips { display: inline-flex; flex-wrap: wrap; gap: 5px; flex: 1; min-width: 160px; }
.n { font-size: 12px; color: var(--slate-500); white-space: nowrap; } .n b { color: var(--slate-900); font-variant-numeric: tabular-nums; } .n em { font-style: normal; font-size: 10px; color: var(--slate-400); } .n.neg b { color: var(--red-700); }
.day__body { padding: 4px 12px 12px; border-top: 1px solid var(--slate-100); display: flex; flex-direction: column; gap: 12px; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1fr); gap: 12px; margin-top: 10px; }
.col { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--slate-100); background: var(--slate-50); }
.col h3 { font-size: 12px; font-weight: 800; color: var(--slate-700); } .col h3 small { font-weight: 500; color: var(--slate-400); margin-left: 4px; }
.col--in { border-left: 4px solid #16a34a; } .col--out { border-left: 4px solid #d97706; } .col--net { border-left: 4px solid var(--blue-600); background: var(--blue-50); } .col--net.loss { border-left-color: #dc2626; background: var(--red-50); }
.big { font-size: 22px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 1.2; } .col--net .big { color: var(--blue-700); } .col--net.loss .big { color: var(--red-700); }
.sub { font-size: 11px; line-height: 1.5; color: var(--slate-500); } .warn { font-size: 11px; font-weight: 600; color: #b45309; }
.lines { margin: 0; display: flex; flex-direction: column; gap: 6px; } .lines > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.lines dt { color: var(--slate-600); } .lines dt small { display: block; font-size: 10px; color: var(--slate-400); } .lines dd { margin: 0; font-weight: 700; color: var(--slate-900); font-variant-numeric: tabular-nums; } .lines dd.in { position: relative; }
.lines input { width: 132px; height: 32px; padding: 0 34px 0 10px; text-align: right; font: inherit; font-size: 13px; font-weight: 700; border: 1px solid var(--slate-300); border-radius: 10px; background: #fff; outline: none; } .lines input:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); } .lines input:disabled { background: var(--slate-100); color: var(--slate-500); }
.lines em { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 10px; color: var(--slate-400); pointer-events: none; }
.total { margin-top: 2px; padding-top: 6px; border-top: 1px dashed var(--slate-300); font-size: 12px; color: var(--slate-600); display: flex; justify-content: space-between; } .total b { font-size: 14px; color: var(--slate-900); }
.btn { align-self: flex-start; height: 34px; padding: 0 14px; border-radius: var(--radius-md); background: var(--blue-600, #2563eb); color: #fff; font-size: 12px; font-weight: 700; margin-top: 6px; } .btn:disabled { opacity: .4; }
.sec h4 { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; font-weight: 800; color: var(--slate-800); margin-bottom: 6px; } .sec h4 small { font-weight: 500; color: var(--slate-500); font-size: 11px; }
.scroll-x { overflow-x: auto; } .tb { width: 100%; border-collapse: collapse; font-size: 12.5px; } .tb th { text-align: left; font-size: 11px; color: var(--slate-500); padding: 4px 8px; white-space: nowrap; } .tb td { padding: 6px 8px; border-top: 1px solid var(--slate-100); white-space: nowrap; } .tb .r { text-align: right; } .tb small { color: var(--slate-400); }
.trip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 10px; border: 1px solid var(--slate-100); border-radius: var(--radius-md); background: var(--slate-50); margin-bottom: 6px; }
.trip__info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 240px; } .trip__info small { font-size: 11px; color: var(--slate-500); } .est { color: #b45309 !important; }
.trip__form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 10px; } .trip__form label { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--slate-500); }
.trip__form input { width: 130px; height: 34px; padding: 0 10px; border: 1px solid var(--slate-300); border-radius: 10px; font: inherit; font-size: 13px; background: #fff; text-align: right; }
.trip__form .btn { margin-top: 0; } .calc { font-size: 11px; color: var(--slate-600); align-self: center; }
@media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
</style>

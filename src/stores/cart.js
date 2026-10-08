import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import { useMemberStore } from './members'
import { useSettingsStore } from './settings'
import { toNumber, round2 } from '@/utils/format'

let lineSeq = 0
let discountSeq = 0

/**
 * ตะกร้ารายการรับซื้อ (ฝั่งขวา)
 *  - 1 บรรทัด = การชั่ง 1 ครั้ง (สินค้าเดิม/ภาชนะเดิมกดซ้ำได้ จะได้บรรทัดใหม่ทุกครั้ง)
 *  - น้ำหนักสุทธิ = น้ำหนักรวม − น้ำหนักภาชนะ (อ่านจากการตั้งค่า settings เสมอ จึงแก้ในบรรทัดไม่ได้)
 *  - ยอดบรรทัด = น้ำหนักสุทธิ × ราคา(บาท/กก.)
 *
 *  ส่วนลด: ลูกค้า 1 คนมีได้หลายรายการ แต่ละรายการคือ
 *    scope = 'all' (ทุกตะกร้า) | uid ของบรรทัด (เฉพาะตะกร้านั้น)
 *    mode  = 'perKg' (ลดบาท/กก. × น้ำหนักสุทธิ) | 'amount' (ลดเป็นเงินคงที่)
 *  ส่วนลดเฉพาะบรรทัดรวมกันแล้วไม่เกินยอดบรรทัดนั้น · ส่วนลดทุกตะกร้าไม่เกินยอดที่เหลือ
 */
export const useCartStore = defineStore('cart', () => {
  const members = useMemberStore()
  const settings = useSettingsStore()

  const lines = ref([]) // { uid, productId, name, pricePerKg, containerId, containerLabel, gross }
  const lastAddedUid = ref(null)

  const customerType = ref('general') // 'member' | 'general'
  const memberId = ref(null)
  const discounts = ref([]) // { id, scope, mode, value }

  // ---- customer ----
  const member = computed(() => members.items.find((m) => m.id === memberId.value) || null)
  const customer = computed(() =>
    customerType.value === 'member'
      ? { type: 'member', memberNo: member.value?.no ?? null, name: member.value?.name ?? null }
      : { type: 'general', memberNo: null, name: 'ลูกค้าทั่วไป' },
  )

  // ---- weights & amounts ----
  const tareOf = (l) => settings.tareOf(l.containerId)
  const netOf = (l) => Math.max(0, toNumber(l.gross) - tareOf(l))
  const amountOf = (l) => round2(netOf(l) * l.pricePerKg)

  const totalNet = computed(() => round2(lines.value.reduce((s, l) => s + netOf(l), 0)))
  const subtotal = computed(() => round2(lines.value.reduce((s, l) => s + amountOf(l), 0)))

  // ---- discounts ----
  const rawAmountOf = (d) => {
    const v = toNumber(d.value)
    if (d.scope === 'all') return round2(d.mode === 'perKg' ? totalNet.value * v : v)
    const line = lines.value.find((l) => l.uid === d.scope)
    return line ? round2(d.mode === 'perKg' ? netOf(line) * v : v) : 0
  }
  const discountRows = computed(() =>
    discounts.value.map((d) => ({ ...d, raw: rawAmountOf(d), line: d.scope === 'all' ? null : lines.value.find((l) => l.uid === d.scope) || null })),
  )

  // effective amounts after clamping
  const clampInfo = computed(() => {
    const perLineRaw = new Map()
    for (const r of discountRows.value) if (r.scope !== 'all') perLineRaw.set(r.scope, round2((perLineRaw.get(r.scope) || 0) + r.raw))
    const perLine = new Map()
    let clamped = false
    for (const [uid, raw] of perLineRaw) {
      const line = lines.value.find((l) => l.uid === uid)
      const eff = Math.min(raw, line ? amountOf(line) : 0)
      if (eff < raw) clamped = true
      perLine.set(uid, eff)
    }
    const lineTotal = round2([...perLine.values()].reduce((s, v) => s + v, 0))
    const allRaw = round2(discountRows.value.filter((r) => r.scope === 'all').reduce((s, r) => s + r.raw, 0))
    const allEff = Math.min(allRaw, Math.max(0, round2(subtotal.value - lineTotal)))
    if (allEff < allRaw) clamped = true
    return { perLine, lineTotal, allEff, clamped }
  })
  const lineDiscountOf = (uid) => clampInfo.value.perLine.get(uid) || 0
  const discountAmount = computed(() => round2(clampInfo.value.lineTotal + clampInfo.value.allEff))
  const discountClamped = computed(() => clampInfo.value.clamped)
  const total = computed(() => round2(subtotal.value - discountAmount.value))

  function addDiscount({ scope, mode, value }) {
    const id = ++discountSeq
    discounts.value.push({ id, scope, mode, value: String(value) })
    return id
  }
  function updateDiscount(id, patch) {
    const d = discounts.value.find((x) => x.id === id)
    if (d) Object.assign(d, patch, patch.value != null ? { value: String(patch.value) } : {})
  }
  function removeDiscount(id) { discounts.value = discounts.value.filter((d) => d.id !== id) }

  // ---- lines ----
  function addLine(product, container) {
    const uid = ++lineSeq
    lines.value.push({
      uid,
      productId: product.id,
      name: product.name,
      pricePerKg: Number(product.price),
      containerId: container.id,
      containerLabel: container.short,
      gross: '',
    })
    lastAddedUid.value = uid
    return uid
  }
  function setGross(uid, value) {
    const l = lines.value.find((x) => x.uid === uid)
    if (l) l.gross = value
  }
  function removeLine(uid) {
    lines.value = lines.value.filter((l) => l.uid !== uid)
    discounts.value = discounts.value.filter((d) => d.scope !== uid) // a basket's own discounts go with it
  }
  function clear() {
    lines.value = []
    discounts.value = []
    lastAddedUid.value = null
  }
  function reset() {
    clear()
    customerType.value = 'general'
    memberId.value = null
  }

  /** status: 'pending' | 'draft' */
  async function submit(status = 'pending') {
    const order = await orderService.create({
      status,
      customer: customer.value,
      items: lines.value.map((l) => ({
        productId: l.productId, name: l.name, containerId: l.containerId, containerLabel: l.containerLabel,
        pricePerKg: l.pricePerKg, gross: toNumber(l.gross), tare: tareOf(l),
        netWeight: round2(netOf(l)), amount: amountOf(l),
      })),
      totalNetWeight: totalNet.value,
      subtotal: subtotal.value,
      discounts: discountRows.value.map((r) => ({
        scope: r.scope === 'all' ? 'all' : 'line',
        lineIndex: r.scope === 'all' ? null : lines.value.findIndex((l) => l.uid === r.scope),
        mode: r.mode, value: toNumber(r.value), amount: r.raw,
      })),
      discountTotal: discountAmount.value,
      total: total.value,
    })
    reset()
    return order
  }

  return {
    lines, lastAddedUid, customerType, memberId, member, customer, discounts, discountRows,
    tareOf, netOf, amountOf, totalNet, subtotal, lineDiscountOf, discountAmount, discountClamped, total,
    addDiscount, updateDiscount, removeDiscount,
    addLine, setGross, removeLine, clear, reset, submit,
  }
})

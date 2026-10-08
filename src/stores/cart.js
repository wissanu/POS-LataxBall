import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import { useMemberStore } from './members'
import { toNumber, round2 } from '@/utils/format'

let seq = 0

/**
 * ตะกร้ารายการรับซื้อ (ฝั่งขวา)
 *  - 1 บรรทัด = การชั่ง 1 ครั้ง (สินค้าเดิม/ภาชนะเดิมกดซ้ำได้ จะได้บรรทัดใหม่ทุกครั้ง)
 *  - น้ำหนักสุทธิ = น้ำหนักรวม − น้ำหนักภาชนะ
 *  - ยอดบรรทัด = น้ำหนักสุทธิ × ราคา(บาท/กก.)
 *  - ส่วนลด: 'perKg' = ลดราคาต่อ กก. (บาท/กก. × น้ำหนักสุทธิรวม) | 'amount' = ลดเป็นจำนวนเงินคงที่
 */
export const useCartStore = defineStore('cart', () => {
  const members = useMemberStore()

  const lines = ref([]) // { uid, productId, name, pricePerKg, containerId, containerLabel, gross, tare }
  const lastAddedUid = ref(null)

  const customerType = ref('general') // 'member' | 'general'
  const memberId = ref(null)
  const discountMode = ref('perKg') // 'perKg' | 'amount'
  const discountValue = ref('')

  // ---- customer ----
  const member = computed(() => members.items.find((m) => m.id === memberId.value) || null)
  const customer = computed(() =>
    customerType.value === 'member'
      ? { type: 'member', memberNo: member.value?.no ?? null, name: member.value?.name ?? null }
      : { type: 'general', memberNo: null, name: 'ลูกค้าทั่วไป' },
  )

  // ---- maths ----
  const netOf = (l) => Math.max(0, toNumber(l.gross) - toNumber(l.tare))
  const amountOf = (l) => round2(netOf(l) * l.pricePerKg)

  const totalNet = computed(() => round2(lines.value.reduce((s, l) => s + netOf(l), 0)))
  const subtotal = computed(() => round2(lines.value.reduce((s, l) => s + amountOf(l), 0)))
  const rawDiscount = computed(() => {
    const v = toNumber(discountValue.value)
    return round2(discountMode.value === 'perKg' ? totalNet.value * v : v)
  })
  const discountAmount = computed(() => Math.min(subtotal.value, rawDiscount.value))
  const discountClamped = computed(() => rawDiscount.value > subtotal.value)
  const total = computed(() => round2(subtotal.value - discountAmount.value))

  // ---- lines ----
  function addLine(product, container) {
    const uid = ++seq
    lines.value.push({
      uid,
      productId: product.id,
      name: product.name,
      pricePerKg: Number(product.price),
      containerId: container.id,
      containerLabel: container.short,
      gross: '',
      tare: container.tare ? String(container.tare) : '',
    })
    lastAddedUid.value = uid
    return uid
  }
  function setLine(uid, field, value) {
    const l = lines.value.find((x) => x.uid === uid)
    if (l) l[field] = value
  }
  function removeLine(uid) { lines.value = lines.value.filter((l) => l.uid !== uid) }
  function clear() {
    lines.value = []
    lastAddedUid.value = null
    discountValue.value = ''
  }
  function reset() {
    clear()
    customerType.value = 'general'
    memberId.value = null
    discountMode.value = 'perKg'
  }

  /** status: 'pending' | 'draft' */
  async function submit(status = 'pending') {
    const order = await orderService.create({
      status,
      customer: customer.value,
      items: lines.value.map((l) => ({
        productId: l.productId, name: l.name, containerId: l.containerId, containerLabel: l.containerLabel,
        pricePerKg: l.pricePerKg, gross: toNumber(l.gross), tare: toNumber(l.tare),
        netWeight: round2(netOf(l)), amount: amountOf(l),
      })),
      totalNetWeight: totalNet.value,
      subtotal: subtotal.value,
      discount: { mode: discountMode.value, value: toNumber(discountValue.value), amount: discountAmount.value },
      total: total.value,
    })
    reset()
    return order
  }

  return {
    lines, lastAddedUid, customerType, memberId, member, customer, discountMode, discountValue,
    netOf, amountOf, totalNet, subtotal, rawDiscount, discountAmount, discountClamped, total,
    addLine, setLine, removeLine, clear, reset, submit,
  }
})

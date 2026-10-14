import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import { useMemberStore } from './members'
import { useSettingsStore } from './settings'
import { toNumber, round2 } from '@/utils/format'

let lineSeq = 0
let additionSeq = 0

/**
 * ตะกร้ารายการรับซื้อ (แผงขวา — แสดงผลเป็นข้อความอย่างเดียว; กรอก/แก้ไขที่หน้าต่างเกรด GradeEntryModal)
 *  - 1 บรรทัด = การชั่ง 1 ครั้ง · แถวของเกรดเดียวกันและภาชนะเดียวกันอยู่ติดกันเสมอ
 *  - น้ำหนักสุทธิ = น้ำหนักที่ชั่งได้ (น้ำหนักสินค้า) − น้ำหนักภาชนะ (อ่านจากการตั้งค่า settings เสมอ)
 *  - ยอดบรรทัด = น้ำหนักสุทธิ × ราคา (บาท/กก.)
 *
 *  เพิ่มราคา (ร้านรับซื้อ = จ่ายลูกค้าเพิ่ม ไม่ใช่ส่วนลด): มีได้หลายรายการต่อลูกค้า 1 คน
 *    scope = 'all' (ทุกตะกร้า) | uid ของบรรทัด (เฉพาะบรรทัดนั้น)
 *    mode  = 'perKg' (เพิ่มบาท/กก. × น้ำหนักสุทธิ) | 'amount' (เพิ่มเป็นเงินคงที่)
 *  ยอดสุทธิ = ยอดรวม + เพิ่มราคา
 */
export const useCartStore = defineStore('cart', () => {
  const members = useMemberStore()
  const settings = useSettingsStore()

  const lines = ref([]) // { uid, productId, name, pricePerKg, containerId, containerLabel, gross }
  const customerType = ref('general') // 'member' | 'general'
  const memberId = ref(null)
  const additions = ref([]) // { id, scope, mode, value }

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

  // ---- เพิ่มราคา ----
  const rawAmountOf = (a) => {
    const v = toNumber(a.value)
    if (a.scope === 'all') return round2(a.mode === 'perKg' ? totalNet.value * v : v)
    const line = lines.value.find((l) => l.uid === a.scope)
    return line ? round2(a.mode === 'perKg' ? netOf(line) * v : v) : 0
  }
  const additionRows = computed(() =>
    additions.value.map((a) => ({ ...a, amount: rawAmountOf(a), line: a.scope === 'all' ? null : lines.value.find((l) => l.uid === a.scope) || null })),
  )
  const lineAdditionOf = (uid) => round2(additionRows.value.filter((r) => r.scope === uid).reduce((s, r) => s + r.amount, 0))
  const additionAmount = computed(() => round2(additionRows.value.reduce((s, r) => s + r.amount, 0)))
  const total = computed(() => round2(subtotal.value + additionAmount.value))

  function addAddition({ scope, mode, value }) {
    const id = ++additionSeq
    additions.value.push({ id, scope, mode, value: String(value) })
    return id
  }
  function updateAddition(id, patch) {
    const a = additions.value.find((x) => x.id === id)
    if (a) Object.assign(a, patch, patch.value != null ? { value: String(patch.value) } : {})
  }
  function removeAddition(id) { additions.value = additions.value.filter((a) => a.id !== id) }

  // ---- lines ----
  const linesOf = (productId, containerId) => lines.value.filter((l) => l.productId === productId && l.containerId === containerId)

  /**
   * บันทึกแถวของ (เกรด, ภาชนะ) หนึ่งกลุ่มจากหน้าต่างเกรด: rows = [{ uid?, gross }]
   *  - แถวที่มี uid = แก้น้ำหนักของบรรทัดเดิม (uid คงเดิม เพื่อให้ เพิ่มราคา ที่ผูกกับบรรทัดนั้นไม่หลุด)
   *  - แถวที่ไม่มี uid = บรรทัดใหม่ · บรรทัดเดิมที่ไม่อยู่ใน rows = ถูกลบ (พร้อมเพิ่มราคาของบรรทัดนั้น)
   *  - บรรทัดใหม่แทรกต่อท้ายกลุ่มเดิม (ไม่เจอกลุ่ม: ต่อท้ายเกรดเดียวกัน / ท้ายสุด) จึงเรียงเป็นกลุ่มติดกันเสมอ
   */
  function setGroup(product, container, rows) {
    const keep = new Set(rows.filter((r) => r.uid).map((r) => r.uid))
    for (const l of linesOf(product.id, container.id)) if (!keep.has(l.uid)) removeLine(l.uid)
    for (const r of rows) {
      if (r.uid) { setGross(r.uid, String(r.gross)); continue }
      let at = -1
      lines.value.forEach((l, i) => { if (l.productId === product.id && l.containerId === container.id) at = i })
      if (at < 0) lines.value.forEach((l, i) => { if (l.productId === product.id) at = i })
      const line = {
        uid: ++lineSeq, productId: product.id, name: product.name, pricePerKg: Number(product.price),
        containerId: container.id, containerLabel: container.short, gross: String(r.gross),
      }
      if (at < 0) lines.value.push(line)
      else lines.value.splice(at + 1, 0, line)
    }
  }
  function setGross(uid, value) {
    const l = lines.value.find((x) => x.uid === uid)
    if (l) l.gross = value
  }
  function removeLine(uid) {
    lines.value = lines.value.filter((l) => l.uid !== uid)
    additions.value = additions.value.filter((a) => a.scope !== uid) // เพิ่มราคาของบรรทัดนั้นหายไปด้วย
  }
  function clear() {
    lines.value = []
    additions.value = []
  }
  function reset() {
    clear()
    customerType.value = 'general'
    memberId.value = null
  }

  /** status: 'pending' (Bill & Print) | 'draft' */
  async function submit(status = 'pending') {
    const order = await orderService.create({
      status,
      customer: customer.value,
      items: lines.value.map((l) => ({ productId: l.productId, containerId: l.containerId, gross: toNumber(l.gross) })),
      additions: additionRows.value
        .map((r) => ({
          scope: r.scope === 'all' ? 'all' : 'line',
          lineIndex: r.scope === 'all' ? null : lines.value.findIndex((l) => l.uid === r.scope),
          mode: r.mode, value: toNumber(r.value),
        })),
    })
    reset()
    return order
  }

  return {
    lines, customerType, memberId, member, customer, additions, additionRows,
    tareOf, netOf, amountOf, totalNet, subtotal, lineAdditionOf, additionAmount, total, linesOf,
    addAddition, updateAddition, removeAddition,
    setGroup, setGross, removeLine, clear, reset, submit,
  }
})

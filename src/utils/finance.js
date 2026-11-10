import { round2, toNumber } from './format'

/**
 * รายรับ - รายจ่าย = กำไร (ฐานเงินสด: นับตามวันที่เกิดรายการ)
 *   รายรับ  = ยอดเงินตามบิลที่โรงงานจ่าย (เที่ยวขนส่งของวันนั้น)
 *   รายจ่าย = ซื้อยางจากลูกค้า (ใบรับซื้อที่ยืนยันแล้ว) + ค่าคนงาน + ค่าขนส่ง + อื่น ๆ
 *   margin  = กำไร ÷ รายรับ × 100  (null เมื่อไม่มีรายรับ)
 */
export function calcProfit({ revenue = 0, purchase = 0, labor = 0, transport = 0, other = 0 } = {}) {
  const rev = toNumber(revenue)
  const expense = round2(toNumber(purchase) + toNumber(labor) + toNumber(transport) + toNumber(other))
  const profit = round2(rev - expense)
  return { revenue: round2(rev), expense, profit, margin: rev > 0 ? round2((profit / rev) * 100) : null }
}

/** % น้ำที่หายระหว่างขนส่งรวมทั้งวัน = (ส่ง − โรงงานชั่งได้) ÷ ส่ง × 100 — null เมื่อข้อมูลไม่ครบ */
export const lossPctOf = (shippedKg, factoryKg) => {
  const s = toNumber(shippedKg); const f = toNumber(factoryKg)
  return s > 0 && f > 0 ? round2(((s - f) / s) * 100) : null
}

/** ประเภทสินค้า (rubber_grades.product_type / transports.product_type) */
export const PRODUCT_TYPES = [
  { code: 'CUP_LUMP', label: 'ยางก้อนถ้วย' },
  { code: 'FOAM', label: 'ขี้ฟอง' },
]
export const productLabel = (code) => PRODUCT_TYPES.find((p) => p.code === code)?.label ?? code

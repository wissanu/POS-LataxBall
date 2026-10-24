import { round2, toNumber } from './format'

/** "HH:mm" -> minutes since midnight (null when empty / invalid) */
export const toMinutes = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? '').trim())
  if (!m) return null
  const h = Number(m[1]); const min = Number(m[2])
  return h > 23 || min > 59 ? null : h * 60 + min
}

/**
 * ระยะเวลาขนส่ง = เวลารับบิลจากโรงงาน − เวลาออกเดินทาง (นาที)
 * ถ้าเวลารับบิลน้อยกว่าเวลาออก ถือว่าข้ามเที่ยงคืน (+24 ชม.)
 */
export const durationMinutes = (departAt, billAt) => {
  const a = toMinutes(departAt); const b = toMinutes(billAt)
  if (a == null || b == null) return null
  return b >= a ? b - a : b + 1440 - a
}

/** 135 -> "2 ชม. 15 นาที" */
export const formatDuration = (min) => {
  if (min == null) return '–'
  const h = Math.floor(min / 60); const m = min % 60
  return h ? `${h} ชม.${m ? ` ${m} นาที` : ''}` : `${m} นาที`
}

/**
 * อัตราการสูญเสียน้ำ
 *   น้ำหนักที่สูญเสีย (กก.) = น้ำหนักก่อนขนส่ง − น้ำหนักสุทธิที่โรงงานชั่งได้
 *   % สูญเสีย = น้ำหนักที่สูญเสีย ÷ น้ำหนักก่อนขนส่ง × 100
 *   % ต่อชั่วโมง = % สูญเสีย ÷ ระยะเวลา (ชม.)   (ไว้เทียบเที่ยวที่ใช้เวลาต่างกัน)
 * คืน null เมื่อข้อมูลไม่ครบ/ไม่ถูกต้อง (น้ำหนักก่อนขนส่งต้อง > 0)
 */
export function calcLoss(shippedKg, factoryNetKg, minutes) {
  const s = toNumber(shippedKg); const f = toNumber(factoryNetKg)
  if (!(s > 0) || !(f > 0)) return null
  const lossKg = round2(s - f)
  const pct = round2((lossKg / s) * 100)
  const perHour = minutes > 0 ? round2(pct / (minutes / 60)) : null
  return { lossKg, pct, perHour } // pct ติดลบ = โรงงานชั่งได้มากกว่าที่ส่งไป
}

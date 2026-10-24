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

// ---------- กราฟแนวโน้มน้ำหนักที่สูญเสีย (หน้า รายงานภาพรวม) ----------

/** ค่าที่พล็อตของหนึ่งช่วงเวลา: lossKg = รวม (กก.) · avgKg = เฉลี่ยต่อเที่ยว (กก.) · lossPct = อัตราสูญเสีย (%) — ไม่มีเที่ยว = null (ไม่ใช่ 0) */
export function metricValue(p, metric) {
  if (!p || !p.trips) return null
  if (metric === 'avgKg') return round2(p.lossKg / p.trips)
  if (metric === 'lossPct') return p.shippedKg > 0 ? round2((p.lossKg / p.shippedKg) * 100) : null
  return p.lossKg
}

/**
 * เส้นแนวโน้ม (ถดถอยเชิงเส้น) จากค่าที่เรียงตามเวลา — ข้ามค่า null
 * คืน null ถ้ามีจุดน้อยกว่า 3 จุด (เร็วเกินกว่าจะบอกแนวโน้ม)
 * direction: up/down เมื่อเส้นแนวโน้มเปลี่ยนเกิน 5% ของค่าเฉลี่ยตลอดช่วง, ไม่งั้น flat (ทรงตัว)
 */
export function linearTrend(values) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null)
  const n = pts.length
  if (n < 3) return null
  const mx = pts.reduce((a, [x]) => a + x, 0) / n
  const my = pts.reduce((a, [, y]) => a + y, 0) / n
  const sxx = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0)
  const slope = sxx ? pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / sxx : 0
  const intercept = my - slope * mx
  const x0 = pts[0][0]; const x1 = pts[n - 1][0]
  const start = intercept + slope * x0; const end = intercept + slope * x1
  const rel = my ? (end - start) / my : 0
  return { n, slope, intercept, x0, x1, start, end, mean: my, changePct: round2(rel * 100), direction: rel > 0.05 ? 'up' : rel < -0.05 ? 'down' : 'flat' }
}

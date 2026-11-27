// ประเมินราคารับซื้อ "รายลูกค้า" — ใช้สูตรเดิมของหน้าประเมินราคา (A_max = P × y − F ÷ W − M) โดย y = DRC ตอนซื้อเฉลี่ยของลูกค้าคนนั้น
//
//   y     DRC ตอนซื้อ (เศษส่วน) = เนื้อยางแห้ง ÷ น้ำหนักที่ซื้อ (รวมน้ำหนักที่หายระหว่างทางไปแล้ว)
//   P     ราคาโรงงาน (บาท/กก. ยางแห้ง 100%) — กรอกเอง      M  กำไรที่ต้องการ (บาท/กก.)
//   F, W  ค่าใช้จ่ายคงที่/วัน และปริมาณรับซื้อ/วันที่คาดไว้ → F ÷ W บาท/กก.
//   A_max ราคารับซื้อสูงสุดที่ยังได้กำไร M  → ปัดลงตามขั้นเป็น "ราคาที่ควรให้"
//
// เทิร์นน้ำ T นาที: น้ำหนักที่ซื้อหายไป l(T) = Lmax × ตัวคูณความเปียก × (1 − e^(−T/τ))
//   เนื้อยางแห้งไม่เปลี่ยน → ยอดเงินรวมที่จ่ายได้เท่าเดิม แต่หารด้วยน้ำหนักที่เหลือ → ราคา/กก. หลังเทิร์นสูงสุด = A_max ÷ (1 − l)
const fin = (x) => Number.isFinite(x)
export const floorTo = (x, step) => (step > 0 ? Math.round(Math.floor(x / step + 1e-9) * step * 1e6) / 1e6 : x)

/** น้ำหนักหาย (%) ที่ T นาที · wet = ตัวคูณความเปียกของยางลูกค้า */
export const lossPctAt = (curve, minutes, wet = 1) => (curve ? curve.lmaxPct * wet * (1 - Math.exp(-Math.max(0, minutes) / curve.tauMin)) : 0)

/** ยางที่ DRC ต่ำกว่าเฉลี่ยร้าน = มีน้ำอิสระมากกว่า → สะเด็ดน้ำได้มากกว่า (สัดส่วนน้ำ (1−DRC) เทียบค่าเฉลี่ยร้าน, จำกัด 0.6–1.6) */
export const wetFactor = (drcPct, globalPct) => (drcPct > 0 && globalPct > 0 && globalPct < 100 ? Math.min(1.6, Math.max(0.6, (100 - drcPct) / (100 - globalPct))) : 1)

/** i = { P, y, M, F, W, step, minutes, curve, wet } (y เป็นเศษส่วน) */
export function quote(i) {
  const P = +i.P || 0, y = +i.y || 0, M = +i.M || 0, F = +i.F || 0, W = +i.W || 0, step = +i.step || 0
  const fixedKg = W > 0 ? F / W : 0
  const value = P * y // มูลค่ายางต่อ กก. ที่ซื้อ
  const aMax = value - fixedKg - M
  const price = P > 0 && y > 0 ? floorTo(aMax, step) : null
  const margin = price == null ? null : value - fixedKg - price
  const at = (minutes) => {
    const l = lossPctAt(i.curve, minutes, i.wet) / 100
    const maxTurn = aMax / (1 - l)
    const priceTurn = P > 0 && y > 0 ? floorTo(maxTurn, step) : null
    return { minutes, lossPct: l * 100, maxTurn, priceTurn, keptKg: 100 * (1 - l), payPer100: priceTurn == null ? null : priceTurn * 100 * (1 - l),
      marginPerKg: priceTurn == null ? null : value - fixedKg - priceTurn * (1 - l) }
  }
  return { P, y, M, fixedKg, value, aMax: fin(aMax) ? aMax : null, price, margin, at, ok: P > 0 && y > 0 }
}

// ---- กราฟ: กำไร/กก. ตามน้ำหนักรับซื้อต่อวัน (ที่ราคารับซื้อเดิมที่แสดง) ----
/** กำไรต่อ กก. (ของน้ำหนักก่อนเทิร์น) ที่น้ำหนักรับซื้อ W กก./วัน เมื่อจ่ายราคาที่แสดงไว้แล้ว เทิร์น `minutes` นาที (0 = ไม่เทิร์น) */
export function profitAt(q, minutes, W) {
  const r = q.at(minutes)
  const paid = r.priceTurn == null ? null : r.priceTurn * (1 - r.lossPct / 100) // เงินที่จ่ายต่อ กก. ก่อนเทิร์น
  if (paid == null || !(W > 0)) return null
  return q.value - (q.F || 0) / W - paid
}
/** น้ำหนักต่อวันที่ต้องรับซื้อ จึงไม่ขาดทุน (F ÷ (มูลค่ายาง − เงินที่จ่ายต่อ กก.)) · null = ไม่มีทางถึงจุดเสมอตัว / ไม่มีต้นทุนคงที่ */
export function breakEvenKg(q, minutes) {
  const r = q.at(minutes)
  if (r.priceTurn == null || !(q.F > 0)) return null
  const unit = q.value - r.priceTurn * (1 - r.lossPct / 100)
  return unit > 0 ? q.F / unit : null
}
const niceMax = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x))); const m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p }
/** ชุดเส้นสำหรับกราฟ: ไม่เทิร์น + (T−10, T, T+10 นาที) */
export function profitSeries(q, F, W, T) {
  q = { ...q, F }
  const mins = [0, ...(T > 0 ? [T - 10, T, T + 10].filter((m) => m > 0) : [])]
  const be = mins.map((m) => breakEvenKg(q, m))
  const xMax = Math.min(30000, niceMax(Math.max(500, (W || 0) * 1.6, ...be.filter(Boolean).map((b) => b * 1.5))))
  const N = 60
  const xs = Array.from({ length: N }, (_, i) => Math.max(1, (xMax * (i + 1)) / N))
  return { xMax, mins: mins.map((m, i) => ({ minutes: m, breakEven: be[i], points: xs.map((x) => ({ x, y: profitAt(q, m, x) })).filter((p) => p.y != null) })) }
}

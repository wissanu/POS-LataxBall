// ประเมินราคารับซื้อ / ความคุ้มค่า — สูตรล้วน (ไม่ผูกกับหน้าจอ) ใช้ร่วมกันทั้งช่องผลลัพธ์และกราฟ
//
// ตัวแปร (หน่วยตามเอกสารสูตร)
//   P  ราคาโรงงานยางแห้ง 100% (บาท/กก.ยางแห้ง)      drc  DRC ที่ประเมิน (เศษส่วน เช่น 0.55)     step  ปัดราคาลงทีละกี่บาท (r: 0.5 / 1)
//   A  ราคาซื้อจากชาวสวน (บาท/กก.สด) — ราคาตลาดฐาน     S    ส่วนต่างที่ร้านใหญ่การันตี (บาท/กก.)     B = A + S  ราคาขายหลังเทิร์น (บาท/กก.)
//   W  น้ำหนักซื้อเข้า (กก.สด)                         L    สัดส่วนน้ำหนักที่หายหลังเทิร์น (เศษส่วน เช่น 0.05)
//   F  ค่าใช้จ่ายคงที่รายวัน (บาท/วัน)                 M    กำไรสุทธิเป้าหมาย (บาท/กก.สด)
//
// สูตร
//   ประเมินเนื้อยาง = P × drc        A (ราคาตลาดประเมิน) = ปัดลง(P × drc, step)
//   W_after = W × (1 − L)            ต้นทุนซื้อ = W × A            รายรับ = W_after × B
//   กำไรขั้นต้น/กก. = (1 − L) × B − A  (= S − B × L เมื่อ B = A + S)
//   กำไรสุทธิ/วัน = W × กำไรขั้นต้น/กก. − F          กำไรสุทธิ/กก. = กำไรขั้นต้น/กก. − F / W
//   L* = (B − A) / B = S / B                          (สูญเสียสูงสุดก่อนขาดทุนขั้นต้น)
//   L** = (B − A − F / W) / B                         (สูญเสียสูงสุดก่อนขาดทุนสุทธิ — รวมค่าใช้จ่ายคงที่)
//   W* = F / กำไรขั้นต้น/กก.                          (ปริมาณซื้อขั้นต่ำต่อวันให้คุ้ม F)
//   A_max = B × (1 − L) − F / W − M                   (ราคารับซื้อสูงสุดที่ยังได้กำไร M)    d = A − A_max (บวก = ต้องหักราคาลง)

const fin = (x) => Number.isFinite(x)
const num = (x) => (fin(Number(x)) ? Number(x) : 0)
export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100

/** ปัดลงเป็นขั้น (เช่น 37.95 → 37.50 เมื่อ step 0.5) · step <= 0 = ไม่ปัด */
export const floorTo = (x, step) => (step > 0 ? Math.round(Math.floor(x / step + 1e-9) * step * 1e6) / 1e6 : x)

/** กำไรสุทธิ/วัน เมื่อกำหนด A, B แยกกัน (ใช้สร้างกราฟและตารางความไว) */
export const netProfit = ({ W, A, B, L, F }) => W * (1 - L) * B - W * A - F

/** i = { P, drc, step, spread, W, A, L, F, M } (drc, L เป็นเศษส่วน) -> ผลคำนวณทั้งหมด */
export function estimate(i) {
  const P = num(i.P), drc = num(i.drc), step = num(i.step), S = num(i.spread)
  const W = Math.max(0, num(i.W)), A = num(i.A), L = Math.min(Math.max(num(i.L), 0), 0.999), F = Math.max(0, num(i.F)), M = num(i.M)
  const B = A + S
  const flesh = P * drc // ราคาเนื้อยางที่ประเมิน (บาท/กก.)
  const aMarket = P > 0 && drc > 0 ? floorTo(flesh, step) : null // ราคารับซื้อตลาดประเมินจาก P (ปัดลงตามขั้น)
  const wAfter = W * (1 - L)
  const lostKg = W * L
  const cost = W * A
  const revenue = wAfter * B
  const noLossRevenue = W * B
  const lostValue = lostKg * B
  const grossKg = (1 - L) * B - A
  const gross = revenue - cost
  const net = gross - F
  const fixedPerKg = W > 0 ? F / W : null
  const netKg = W > 0 ? net / W : null
  const lStar = B > 0 ? (B - A) / B : null
  const lStar2 = B > 0 && W > 0 ? (B - A - F / W) / B : null
  const wStar = grossKg > 0 ? F / grossKg : null // null = ไม่มีทางคุ้ม (กำไรขั้นต้น/กก. <= 0)
  const aMax = W > 0 ? B * (1 - L) - F / W - M : null
  const d = aMax == null ? null : A - aMax // บวก = ต้องหักราคารับซื้อลง · ลบ = ยังมีที่ให้ขึ้นราคาได้
  const aMaxStep = aMax == null ? null : floorTo(aMax, step) // ราคาที่ตั้งจริงได้ (ปัดลงตามขั้น)
  return { P, drc, step, S, W, A, B, L, F, M, flesh, aMarket, wAfter, lostKg, cost, revenue, noLossRevenue, lostValue, grossKg, gross, net, fixedPerKg, netKg, lStar, lStar2, wStar, aMax, aMaxStep, d,
    verdict: net > 0.005 ? 'profit' : net < -0.005 ? 'loss' : 'even' }
}

const linspace = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n)

/** กำไรสุทธิ/วัน เมื่อ L เปลี่ยน (จุดอื่นคงเดิม) */
export function curveByLoss(e, n = 60) {
  const hi = Math.min(0.6, Math.max(e.L * 2, (e.lStar2 ?? 0) * 1.4, (e.lStar ?? 0) * 1.2, 0.12))
  return linspace(0, hi, n).map((x) => ({ x, y: netProfit({ ...e, L: x }) }))
}
/** กำไรสุทธิ/วัน เมื่อปริมาณซื้อ W เปลี่ยน */
export function curveByVolume(e, n = 60) {
  const hi = Math.max(e.W * 2, (e.wStar ?? 0) * 2, 100)
  return linspace(0, hi, n).map((x) => ({ x, y: netProfit({ ...e, W: x }) }))
}
/** กำไรสุทธิ/กก. เมื่อราคารับซื้อจริงที่ตั้ง (A) เปลี่ยน โดยราคาขาย B คงที่ (B ยึดตามราคาตลาด A เดิม + S) */
export function curveByBuyPrice(e, n = 60) {
  const lo = Math.max(0, e.A - Math.max(4, e.S * 2)), hi = e.A + Math.max(2, e.S)
  return linspace(lo, hi, n).map((x) => ({ x, y: e.W > 0 ? netProfit({ ...e, A: x }) / e.W : 0 }))
}

/** ความไวของกำไรสุทธิ/วัน ต่อแต่ละปัจจัย — ขยับทีละตัวด้วย "ก้าวที่เกิดขึ้นจริงได้" (ราคา ±1 บาท/กก. · สูญเสีย ±1 จุด% · ปริมาณและค่าใช้จ่าย ±10%) เรียงจากกระทบมากไปน้อย */
export function sensitivity(e) {
  const base = netProfit(e)
  const defs = [
    { key: 'A', label: 'ราคารับซื้อ A', step: '±1 บาท/กก.', lo: { A: e.A + 1 }, hi: { A: Math.max(0, e.A - 1) }, down: 'ซื้อแพงขึ้น', up: 'ซื้อถูกลง' },
    { key: 'B', label: 'ราคาขาย B', step: '±1 บาท/กก.', lo: { B: Math.max(0, e.B - 1) }, hi: { B: e.B + 1 }, down: 'ขายได้ลดลง', up: 'ขายได้เพิ่มขึ้น' },
    { key: 'L', label: 'สูญเสียน้ำหนัก L', step: '±1 จุด %', lo: { L: Math.min(0.999, e.L + 0.01) }, hi: { L: Math.max(0, e.L - 0.01) }, down: 'สูญเสียเพิ่ม', up: 'สูญเสียลด' },
    { key: 'W', label: 'ปริมาณซื้อ W', step: '±10%', lo: { W: e.W * 0.9 }, hi: { W: e.W * 1.1 }, down: 'ซื้อน้อยลง', up: 'ซื้อมากขึ้น' },
    { key: 'F', label: 'ค่าใช้จ่ายคงที่ F', step: '±10%', lo: { F: e.F * 1.1 }, hi: { F: e.F * 0.9 }, down: 'ค่าใช้จ่ายเพิ่ม', up: 'ค่าใช้จ่ายลด' },
  ]
  return defs
    .map((d) => {
      const down = netProfit({ ...e, ...d.lo }) - base // ผลเมื่อปัจจัยเปลี่ยนไปทางแย่
      const up = netProfit({ ...e, ...d.hi }) - base // ผลเมื่อปัจจัยเปลี่ยนไปทางดี
      return { key: d.key, label: d.label, step: d.step, down, up, span: Math.abs(up) + Math.abs(down), downLabel: d.down, upLabel: d.up }
    })
    .sort((a, b) => b.span - a.span)
}

/** น้ำตกกำไร: รายรับถ้าไม่สูญเสีย → หักน้ำหนักที่หาย → หักต้นทุนซื้อ → กำไรขั้นต้น → หัก F → กำไรสุทธิ */
export function waterfall(e) {
  return [
    { key: 'full', label: 'รายรับถ้าไม่สูญเสีย', value: e.noLossRevenue, type: 'total' },
    { key: 'lost', label: 'น้ำหนักที่หาย', value: -e.lostValue, type: 'delta' },
    { key: 'cost', label: 'ต้นทุนซื้อยาง', value: -e.cost, type: 'delta' },
    { key: 'gross', label: 'กำไรขั้นต้น', value: e.gross, type: 'total' },
    { key: 'fixed', label: 'ค่าใช้จ่ายคงที่', value: -e.F, type: 'delta' },
    { key: 'net', label: 'กำไรสุทธิ', value: e.net, type: 'total' },
  ]
}

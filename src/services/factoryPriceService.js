import { http } from './http'

// ราคากลางยางก้อนถ้วย (DRC 100%) รายวัน → ราคาโรงงานที่ประเมิน (แก้เองได้) — สิทธิ์ report.view
// GET  /factory-price/today  -> { date, ref: { price, date, source, lagDays }|null, offset: { baht, n }, estPrice, manualPrice, price,
//                                 status: 'ok'|'stale'|'none', note, lastError, fetchedAt, expectedRefDate, consistency: { verdict, n, meanOffset, sdOffset } }
//                               (ถ้ายังไม่เคยดึงวันนี้ server ดึงให้ วันละครั้ง)
// PUT  /factory-price/today  { price: number|null }   แก้ราคาโรงงานของวันนี้เอง (null = ล้าง)
// POST /factory-price/refresh                         บังคับดึงใหม่ (ห่าง ≥ 3 นาที)
// GET  /factory-price/check  -> { verdict: insufficient|good|fair|poor, n, meanOffset, sdOffset, paidPctOfRefMean, moves, moveAgree, rows: [...], missingRefDates }
// POST /factory-price/ref    { date, price }          เติมราคากลางย้อนหลังเอง -> ผลเดียวกับ check
// GET  /factory-price/day?date=   -> { date, price: ราคาโรงงานที่ผู้ใช้กำหนดของวันนั้น|null, setAt, suggestion: ราคาที่ระบบประเมิน (เฉพาะวันนี้)|null }   สิทธิ์ purchase.create
// PUT  /factory-price/day { date, price|null }  กำหนด/ล้างราคาโรงงานของวันที่ลงบิล (หน้ารับออเดอร์ใหม่) — สิทธิ์ price.manage · ใช้ข้อมูลชุดเดียวกับหน้า "ประเมินราคา"
export const factoryPriceService = {
  day: (date) => http.get('/factory-price/day', { params: { date } }).then((r) => r.data),
  setDay: (date, price) => http.put('/factory-price/day', { date, price }).then((r) => r.data),
  today: () => http.get('/factory-price/today').then((r) => r.data),
  setToday: (price) => http.put('/factory-price/today', { price }).then((r) => r.data),
  refresh: () => http.post('/factory-price/refresh').then((r) => r.data),
  check: () => http.get('/factory-price/check').then((r) => r.data),
  addRef: (date, price) => http.post('/factory-price/ref', { date, price }).then((r) => r.data),
}

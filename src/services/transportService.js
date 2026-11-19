import { http } from './http'

// การขนส่งยางก้อนถ้วยไปโรงงาน: 1 แถว = 1 เที่ยว
// Trip = { id, date: 'YYYY-MM-DD', tripNo, shippedKg, departAt: 'HH:mm', billAt: 'HH:mm', factoryNetKg, note,
//          factoryDrcPct: number|null (DRC% — มีค่า = factoryPricePerKg เป็นราคาต่อ กก. ยางแห้ง ยอดบิล = น้ำหนักสุทธิ x DRC% x ราคา),
//          factoryPricePerKg: number|null, factoryAmount: number|null   (ยอดเงินตามบิลโรงงาน — ใหม่ · ไม่บังคับ · null = ยังไม่กรอก),
//          productType: 'CUP_LUMP'|'FOAM' (ค่าเริ่มต้น CUP_LUMP), stockKg: number|null (น้ำหนักตอนซื้อที่ตัดสต็อก · null = เท่ากับ shippedKg),
//          durationMin, lossKg, lossPct, lossPctPerHour, createdAt }   (ฟิลด์ที่คำนวณ server เป็นผู้ส่งกลับ — ใช้สูตรเดียวกับ utils/transport.js)
//
// GET    /transports?from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize=
//          -> { page, pageSize, total, totalPages, summary: { trips, shippedKg, factoryNetKg, factoryAmount, lossKg, lossPct }, data: Trip[] }
// POST   /transports   { date, shippedKg, departAt, billAt, factoryNetKg, factoryPricePerKg?, factoryAmount?, productType?, stockKg?, note? }  -> Trip   (tripNo รันต่อวันโดย server)
// PATCH  /transports/:id  (ฟิลด์เดียวกัน บางส่วนได้)                                -> Trip
// DELETE /transports/:id                                                            -> 204
//
// GET    /transports/report?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month   (กราฟใน รายงานภาพรวม)
//          -> { range: { from, to, groupBy, days }, windows: [{ key: 'MORNING', label: '06:00 – 12:00' }, { key: 'AFTERNOON', label: '13:00 – 18:00' }],
//               series: [{ key, from, MORNING: { trips, shippedKg, lossKg }, AFTERNOON: { ... } }],   // ช่วงที่ไม่มีเที่ยว trips = 0
//               summary: { MORNING: { trips, shippedKg, lossKg, lossPct|null }, AFTERNOON: { ... } },
//               otherTrips }   // เที่ยวที่ออกนอกสองช่วง (เช่น 12:01-12:59 หรือหลัง 18:00) ไม่อยู่ในกราฟ
// ช่วงเวลานับจาก "เวลาออกเดินทาง" · สิทธิ์: transport.read (ดู) / transport.create (เพิ่ม แก้ไข ลบ) = MANAGER และ ADMIN เท่านั้น
// GET    /transports/summary?ids=a,b,c   หรือ   ?from=YYYY-MM-DDTHH:mm&to=YYYY-MM-DDTHH:mm   (popup สรุปผล: ที่ติ๊กเลือก / ช่วงวัน-เวลาออกเดินทาง)
//          -> { mode, range, trips, firstDate, lastDate, shippedKg, factoryNetKg, lossKg, lossPct (ถ่วงน้ำหนัก), avgLossPct (เฉลี่ยรายเที่ยว),
//               avgLossKgPerTrip, avgShippedKgPerTrip, avgDurationMin, avgLossPctPerHour, maxTrip, minTrip, windows: [{ key, label, trips, shippedKg, lossKg, lossPct }] }
export const transportService = {
  report: (params) => http.get('/transports/report', { params }).then((r) => r.data),
  summary: (params) => http.get('/transports/summary', { params }).then((r) => r.data),
  list: (params) => http.get('/transports', { params }).then((r) => r.data),
  create: (payload) => http.post('/transports', payload).then((r) => r.data),
  update: (id, payload) => http.patch(`/transports/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/transports/${id}`),
}

// ฉบับร่างเที่ยวขนส่ง (กรอกค้างแล้วปิดหน้าต่าง) — ใช้ร่วมกันทุกคนที่มีสิทธิ์การขนส่ง
// Draft = { id, payload: {...ค่าในฟอร์ม}, createdAt, updatedAt, by }
//   GET /transports/drafts · POST /transports/drafts { payload } · PATCH /transports/drafts/:id { payload } · DELETE /transports/drafts/:id
export const transportDraftService = {
  list: () => http.get('/transports/drafts').then((r) => r.data),
  create: (payload) => http.post('/transports/drafts', { payload }).then((r) => r.data),
  update: (id, payload) => http.patch(`/transports/drafts/${id}`, { payload }).then((r) => r.data),
  remove: (id) => http.delete(`/transports/drafts/${id}`),
}

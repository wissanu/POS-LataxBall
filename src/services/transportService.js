import { http } from './http'

// การขนส่งยางก้อนถ้วยไปโรงงาน: 1 แถว = 1 เที่ยว
// Trip = { id, date: 'YYYY-MM-DD', tripNo, shippedKg, departAt: 'HH:mm', billAt: 'HH:mm', factoryNetKg, note,
//          durationMin, lossKg, lossPct, lossPctPerHour, createdAt }   (ฟิลด์ที่คำนวณ server เป็นผู้ส่งกลับ — ใช้สูตรเดียวกับ utils/transport.js)
//
// GET    /transports?from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize=
//          -> { page, pageSize, total, totalPages, summary: { trips, shippedKg, factoryNetKg, lossKg, lossPct }, data: Trip[] }
// POST   /transports   { date, shippedKg, departAt, billAt, factoryNetKg, note? }  -> Trip   (tripNo รันต่อวันโดย server)
// PATCH  /transports/:id  (ฟิลด์เดียวกัน บางส่วนได้)                                -> Trip
// DELETE /transports/:id                                                            -> 204
//
// GET    /transports/report?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month   (กราฟใน รายงานภาพรวม)
//          -> { range: { from, to, groupBy, days }, windows: [{ key: 'MORNING', label: '06:00 – 12:00' }, { key: 'AFTERNOON', label: '13:00 – 18:00' }],
//               series: [{ key, from, MORNING: { trips, shippedKg, lossKg }, AFTERNOON: { ... } }],   // ช่วงที่ไม่มีเที่ยว trips = 0
//               summary: { MORNING: { trips, shippedKg, lossKg, lossPct|null }, AFTERNOON: { ... } },
//               otherTrips }   // เที่ยวที่ออกนอกสองช่วง (เช่น 12:01-12:59 หรือหลัง 18:00) ไม่อยู่ในกราฟ
// ช่วงเวลานับจาก "เวลาออกเดินทาง" · สิทธิ์: transport.read (ดู) / transport.create (เพิ่ม แก้ไข ลบ) = MANAGER และ ADMIN เท่านั้น
export const transportService = {
  report: (params) => http.get('/transports/report', { params }).then((r) => r.data),
  list: (params) => http.get('/transports', { params }).then((r) => r.data),
  create: (payload) => http.post('/transports', payload).then((r) => r.data),
  update: (id, payload) => http.patch(`/transports/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/transports/${id}`),
}

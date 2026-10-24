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
export const transportService = {
  list: (params) => http.get('/transports', { params }).then((r) => r.data),
  create: (payload) => http.post('/transports', payload).then((r) => r.data),
  update: (id, payload) => http.patch(`/transports/${id}`, payload).then((r) => r.data),
  remove: (id) => http.delete(`/transports/${id}`),
}

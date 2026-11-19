import { http } from './http'

export const orderService = {
  /**
   * GET /orders — แบ่งหน้าที่ server
   * params: { range: 'today'|'month' (ใช้เมื่อไม่ค้นหา), page, pageSize, status, q, customerId, from, to }
   * -> { range, search, windowFrom, windowTo, date, page, pageSize, total, totalPages, data: Order[], queue: [{ id, no, status }] }
   */
  /** ชื่อที่เคยกรอก (ลูกค้าทั่วไป/สวน) ไว้เติมอัตโนมัติ — [{ name, n }] */
  names: (type, q) => http.get('/orders/names', { params: { type, q: q || undefined } }).then((r) => r.data),
  list: (params) => http.get('/orders', { params }).then((r) => r.data),
  /** GET /orders/customers?q= — ค้นหาลูกค้า (ชื่อซ้ำได้) -> [{ id, type, code, name, phone, address, orderCount }] */
  customers: (q) => http.get('/orders/customers', { params: { q } }).then((r) => r.data),
  /** POST /orders — payload.billDate = 'YYYY-MM-DD' ทำบิลย้อนหลัง (ใช้ราคาและลงวันที่ของวันนั้น) · ไม่ส่ง = วันนี้ */
  create: (payload) => http.post('/orders', payload).then((r) => r.data),
  updateStatus: (id, status) => http.patch(`/orders/${id}`, { status }).then((r) => r.data),
}

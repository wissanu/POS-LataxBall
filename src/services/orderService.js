import { http } from './http'

export const orderService = {
  /**
   * GET /orders — แบ่งหน้าที่ server
   * params: { scope: 'today'|'all', page, pageSize, status, q, customerId, from, to }
   * -> { scope, search, date, page, pageSize, total, totalPages, data: Order[], queue: [{ id, no, status }] }
   */
  list: (params) => http.get('/orders', { params }).then((r) => r.data),
  /** GET /orders/customers?q= — ค้นหาลูกค้า (ชื่อซ้ำได้) -> [{ id, type, code, name, phone, address, orderCount }] */
  customers: (q) => http.get('/orders/customers', { params: { q } }).then((r) => r.data),
  create: (payload) => http.post('/orders', payload).then((r) => r.data),
  updateStatus: (id, status) => http.patch(`/orders/${id}`, { status }).then((r) => r.data),
}

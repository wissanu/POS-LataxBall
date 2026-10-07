import { http } from './http'

export const orderService = {
  list: (params) => http.get('/orders', { params }).then((r) => r.data), // { data: Order[], queue: [] }
  create: (payload) => http.post('/orders', payload).then((r) => r.data),
  updateStatus: (id, status) => http.patch(`/orders/${id}`, { status }).then((r) => r.data),
}

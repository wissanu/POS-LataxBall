import { http } from './http'

// ราคารับซื้อรายวัน: 1 วัน = 1 กลุ่ม มีเกรด A, B+, B, C+, C, D
//
// GET  /price-board[?date=YYYY-MM-DD]
//   -> { serverTime, today, date, exists, board: { id, date, copiedFrom, createdAt } | null,
//        grades: [{ code, name }],            // เกรดที่ใช้งาน (ไว้สร้างฟอร์มตั้งราคา)
//        items:  [{ id, grade, name, price }], // รายการของวันนั้น (id = productId ตอนส่ง order)
//        yesterday: { date, available } }      // available = มีข้อมูลเมื่อวานให้ sync
// PUT  /price-board/today          { prices: { A: 29.5, 'B+': 28, ... } }  -> same (สร้างต้องครบทุกเกรด / แก้ส่งบางเกรดได้)
// POST /price-board/sync-yesterday                                          -> same
// POST /price-board/today/discard  { itemIds: [uuid] }                      -> same
export const priceBoardService = {
  get: (date) => http.get('/price-board', { params: date ? { date } : undefined }).then((r) => r.data),
  save: (prices) => http.put('/price-board/today', { prices }).then((r) => r.data),
  syncYesterday: () => http.post('/price-board/sync-yesterday').then((r) => r.data),
  discard: (itemIds) => http.post('/price-board/today/discard', { itemIds }).then((r) => r.data),
}

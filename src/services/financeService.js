import { http } from './http'

// รายรับ-รายจ่าย-กำไร — สิทธิ์: transport.read (ดู) / transport.create (บันทึกค่าใช้จ่าย) = MANAGER และ ADMIN
//
// GET /finance/daily?date=YYYY-MM-DD   (แผง "สรุปกำไรประจำวัน" ในหน้า Orders)
//   -> { date,
//        purchaseTotal, purchaseKg, bills,                       // ซื้อยางจากลูกค้า: ใบรับซื้อสถานะ complete ของวันนั้น
//        trips, billTrips, shippedKg, factoryNetKg, revenue,     // เที่ยวขนส่งของวันนั้น · billTrips = เที่ยวที่กรอกยอดบิลโรงงานแล้ว · revenue = ผลรวม factoryAmount
//        laborCost, transportCost, otherCost, note }              // ค่าใช้จ่ายที่กรอกเอง (ไม่มีแถว = 0)
// PUT /finance/expenses/:date   { laborCost, transportCost, otherCost, note? }  -> ค่าเดียวกับ GET /finance/daily (upsert ต่อวัน)
//
// GET /finance/report?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month   (กราฟ "รายรับ-รายจ่าย-กำไร" ใน รายงานภาพรวม)
//   -> { range: { from, to, groupBy, days },
//        summary: { revenue, purchase, labor, transport, other, shippedKg, factoryNetKg, trips, billTrips },
//        series:  [{ key, from, revenue, purchase, labor, transport, other }] }   // ช่วงที่ไม่มีข้อมูลเป็น 0 · กำไร/รวมรายจ่ายคำนวณที่ front-end (utils/finance.js)
// GET /finance/range?from&to   (แท็บ "ช่วงวัน / ยางค้างคืน" ของแผงสรุปกำไร) — ต้นทุนยางที่ขายคิดแบบเข้าก่อนออกก่อน (FIFO)
//   -> { range: { from, to, days },
//        summary: { purchaseKg, purchaseTotal, bills, trips, billTrips, unbilledTrips, shippedKg, factoryNetKg,
//                   revenue, cogs, labor, transport, other, profit, cashProfit, uncoveredKg },
//        trips: [{ id, date, tripNo, productType, shippedKg, stockKg, factoryNetKg, factoryAmount, cost, profit, avgNights, maxNights, uncoveredKg,
//                  sources: [{ date, kg, nights, cost }] }],           // sources = ยางที่ส่งรอบนี้มาจากการซื้อวันไหนบ้าง
//        stock: { kg, value, oldestDate, oldestNights, lots: [{ date, productType, kg, costPerKg, value, nights }] } }   // ยางคงเหลือ ณ สิ้นสุดช่วง
export const financeService = {
  range: (from, to) => http.get('/finance/range', { params: { from, to } }).then((r) => r.data),
  daily: (date) => http.get('/finance/daily', { params: { date } }).then((r) => r.data),
  saveExpenses: (date, payload) => http.put(`/finance/expenses/${date}`, payload).then((r) => r.data),
  report: (params) => http.get('/finance/report', { params }).then((r) => r.data),
}

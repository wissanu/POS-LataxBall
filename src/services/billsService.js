import { http } from './http'

// บิลขายโรงงาน (1 เที่ยวขนส่ง = 1 บิลขาย เลขที่ SAL-YYYYMMDD-NN) + สรุปรายวันที่ซื้อยาง — สิทธิ์: transport.read
// ทุกรายการแบ่งหน้าที่ server: ส่ง page / pageSize (ค่าเริ่มต้น 10) แล้วได้เฉพาะหน้านั้น
//
// GET /bills/days?from&to&basis=buy|sale&q=&page&pageSize
//   -> { range, page, pageSize, total, totalPages,
//        rows: [{ date, bills, cupKg, foamKg, amount, leftCupKg, leftFoamKg, waitingSameDay, waitingOvernight, saleBills: [{ id, no }] }] }
// GET /bills/sales?from&to&basis=buy|sale&q=&page&pageSize
//   -> { range, page, pageSize, total, totalPages,
//        rows: [{ id, no, saleDate, tripNo, productType, shippedKg, factoryNetKg, factoryPricePerKg, factoryDrcPct, factoryAmount, lossPct,
//                 sources: [{ date, bills, cupKg, foamKg, cost, avgPrice, lines: [{ grade, price, kg, amount }] }], sourceDates, matchedDates, cost, profit, legacy, buyDrcPct, dryKg }] }
// GET /bills/sales/:id/customers   (ดึงตอนกางบิล) — แยกรายลูกค้า ณ วันที่ซื้อยาง
//   -> { id, no, saleDate, productType, factoryPriceBill, factoryDrcPct, factoryAmount, lotDrcPct, waitingBill,
//        rows: [{ date, key, name, type, purchaseNos, kg, cost, buyPrice, factoryPriceDay, estDrcPct, estProfitPerKg,
//                 actualDrcPct, actualBasis: 'measured'|'model'|'lot'|null, drcGapPct, revenue, actualProfitPerKg,
//                 grossProfit, recovered, expenseShare, netProfit, photos: [photoId] }] }
//
// GET /bills/pending  — รอจัดการบิล แยกตามวันที่ซื้อยาง (กำลังจัดส่ง · รอจัดส่ง · ขายแล้วแต่ยังรอยอดบิลโรงงาน) + ประมาณการบิลที่ยังไม่ได้ขาย
export const billsService = {
  days: (params) => http.get('/bills/days', { params }).then((r) => r.data),
  sales: (params) => http.get('/bills/sales', { params }).then((r) => r.data),
  saleCustomers: (id) => http.get(`/bills/sales/${id}/customers`).then((r) => r.data),
  pending: () => http.get('/bills/pending').then((r) => r.data),
  // วันที่ยางถูกบิลโรงงานครบ (จัดส่งเรียบร้อย) ค้างใน pending จนกว่าผู้ใช้ยืนยันเอง — pending ตอบ days[].done / sold[] / summary.doneDays / confirmedRecent
  confirmDay: (date) => http.post(`/bills/days/${date}/confirm`).then((r) => r.data),
  reopenDay: (date) => http.delete(`/bills/days/${date}/confirm`).then((r) => r.data),
}

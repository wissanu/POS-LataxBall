import { http } from './http'

// บิลขายโรงงาน (1 เที่ยวขนส่ง = 1 บิลขาย เลขที่ SAL-YYYYMMDD-NN) + สรุปรายวันที่ซื้อยาง — สิทธิ์: transport.read
// GET /bills?from&to&basis=buy|sale&q=
//   basis=buy (ค่าเริ่มต้น): ค้นตาม "วันที่ซื้อยาง" — เจอบิลขายที่รวมยางของวันนั้น แม้ขายวันอื่น · basis=sale: ค้นตามวันที่ขายให้โรงงาน
//   -> { range: { from, to, basis },
//        days:  [{ date, bills, cupKg, foamKg, amount, leftCupKg, leftFoamKg, waitingSameDay, waitingOvernight, saleBillIds: [] }],
//        sales: [{ id, no, saleDate, tripNo, productType, shippedKg, factoryNetKg, factoryPricePerKg, factoryAmount, lossPct,
//                  sources: [{ date, bills, cupKg, foamKg, cost, avgPrice, lines: [{ grade, price, kg, amount }] }],   // ราคารับซื้อของวันนั้น
//                  sourceDates: [], matchedDates: [], cost, profit, legacy }] }
export const billsService = {
  list: (params) => http.get('/bills', { params }).then((r) => r.data),
}

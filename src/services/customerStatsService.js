import { http } from './http'

// ข้อมูลลูกค้า + DRC ตอนซื้อเฉลี่ยรายลูกค้า (คำนวณจากบิลขายโรงงานทุกครั้ง) — สิทธิ์: report.view
//   DRC ตอนซื้อ = (น้ำหนักสุทธิโรงงาน x DRC% โรงงาน) ÷ น้ำหนักที่ซื้อมา
// GET /customer-stats -> { globalDrcPct, lotCount, skippedLots, options: { halfLifeDays, priorKg },
//        levels: [{ level 1-5, label, deltaPct (ผลต่อ DRC เทียบ "ปกติ" ที่เรียนรู้จากบิลจริง), priorPct (ค่าตั้งต้น), kg (น้ำหนักที่จดระดับนี้) }],
//        lossCurve: { lmaxPct, tauMin, points, source: 'prior'|'blend'|'fit' },      // น้ำหนักหาย(%) = lmaxPct x (1 − e^(−นาที/tauMin))
//        customers: [{ key, name, type: member|general|garden, orders, boughtKg, lastBuyDate,
//                      drcPct (ตามปกติของลูกค้า), baseDrcPct (ถ้ายางระดับ ปกติ), ratedPct, levelKg: {1..5}, simplePct, safePct, sePct, lots, pureLots, lastDrcPct, lastDate, trendPct, confidence: none|low|mid|high }] }
// GET /customer-stats/detail?key= -> { ...เหมือนด้านบนแต่ไม่มี customers, customer, history: [{ saleNo, date, tripNo, lotDrcPct, kg, sharePct }] }
export const customerStatsService = {
  list: () => http.get('/customer-stats').then((r) => r.data),
  detail: (key) => http.get('/customer-stats/detail', { params: { key } }).then((r) => r.data),
}

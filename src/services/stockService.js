import { http } from './http'

// ยางรอขาย (รับซื้อแล้วแต่ยังไม่ได้ขายให้โรงงาน) — สิทธิ์: transport.read (ดู) / transport.create (เปลี่ยนสถานะ) = MANAGER และ ADMIN
//
// GET /stock/unsold?tripId=   (tripId ไม่บังคับ: ตอนแก้ไขเที่ยว นับยางที่เที่ยวนั้นตัดไปแล้วเป็น "เลือกได้" ด้วย)
//   -> { summary: { sameDay: { bills, cupKg, foamKg, cost }, overnight: { ... } },
//        days: [{ date: 'YYYY-MM-DD',
//                 sameDay: { bills, cupKg, foamKg, cost }, overnight: { ... },
//                 bills: [{ id, no, date, time, hold: 'SAME_DAY'|'OVERNIGHT', customer, cupKg, foamKg, cupCost, foamCost, partial }] }] }
//        cupKg / foamKg = น้ำหนักที่ "ยังไม่ได้ขาย" (ยางก้อนถ้วย / ขี้ฟอง) · partial = ขายไปบางส่วนแล้ว (เช่น ขายยางก้อนถ้วยแล้ว เหลือขี้ฟอง)
// PATCH /stock/hold-status   { purchaseIds: string[], status: 'SAME_DAY'|'OVERNIGHT' }  -> { updated }
export const stockService = {
  // draftId = ฉบับร่างที่กำลังเปิดแก้ (ใบที่ฉบับร่างนี้จองไว้ไม่ถือว่าถูกล็อก) · แต่ละใบมี cupLock / foamLock = id ฉบับร่างอื่นที่จองไว้ ("กำลังจัดส่ง") หรือ null
  unsold: (tripId, draftId) => http.get('/stock/unsold', { params: { ...(tripId ? { tripId } : {}), ...(draftId ? { draftId } : {}) } }).then((r) => r.data),
  setHold: (purchaseIds, status) => http.patch('/stock/hold-status', { purchaseIds, status }).then((r) => r.data),
}
export const HOLD = { SAME_DAY: 'ขายต่อวัน', OVERNIGHT: 'ค้างคืน' }

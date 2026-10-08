// ภาชนะที่ใช้ใส่สินค้า — ค่าเริ่มต้นอยู่ใน containers.json
//
//  tare  = น้ำหนักภาชนะ (กก.) ที่ระบบหักออกจากน้ำหนักรวมอัตโนมัติ
//  fixed = true  → ค่าถูกล็อก แก้ไม่ได้ (เช่น "ไม่ได้ใส่ภาชนะ" ต้องเป็น 0 เสมอ)
//
// การแก้ค่า tare: กดปุ่มฟันเฟืองที่หน้า "จัดทำรายการ" → ระบบเรียก PUT /settings/containers
// (แก้ได้อย่างเดียว: ไม่มีการเพิ่ม/ลบภาชนะผ่านหน้าจอ) ส่วนจะเพิ่ม/ลบชนิดภาชนะ ให้แก้ที่ containers.json
import doc from './containers.json'

export const DEFAULT_CONTAINER_DOC = doc
export const DEFAULT_CONTAINERS = doc.containers

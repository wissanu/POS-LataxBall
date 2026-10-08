// ภาชนะที่ใช้ใส่สินค้า (ปุ่มใน popup ตอนกดเลือกสินค้า)
//
//  id     : รหัสภายใน (ห้ามซ้ำ)
//  label  : ข้อความบนปุ่มใน popup
//  short  : ข้อความสั้นที่แสดงในรายการด้านขวา
//  icon   : 'none' | 'keng' | 'basket'   (รูปแบบไอคอน)
//  scale  : ขนาดไอคอนของตะกร้า (ใหญ่ → เล็ก)
//  tare   : น้ำหนักภาชนะ (กก.) ที่หักออกจากน้ำหนักรวมอัตโนมัติ — ตั้งค่าตรงนี้ได้เลย
//           (ตอนนี้เป็น 0 ทั้งหมด และแก้เป็นรายบรรทัดในรายการได้ด้วย)
//
// อยากเพิ่ม/ลดปุ่ม: เพิ่มหรือลบบรรทัดในรายการนี้ได้เลย ปุ่มจะจัดเป็นตาราง 3 คอลัมน์ให้อัตโนมัติ
export const CONTAINERS = [
  { id: 'none', label: 'ไม่ได้ใส่ภาชนะ', short: 'ไม่มีภาชนะ', icon: 'none', tare: 0 },
  { id: 'keng', label: 'ใส่ตะกร้าเข่ง', short: 'ตะกร้าเข่ง', icon: 'keng', tare: 0 },
  { id: 'xxl', label: 'ตะกร้าขนาด XXL', short: 'ตะกร้า XXL', icon: 'basket', scale: 1, tare: 0 },
  { id: 'xl', label: 'ตะกร้าขนาด XL', short: 'ตะกร้า XL', icon: 'basket', scale: 0.92, tare: 0 },
  { id: 'l', label: 'ตะกร้าขนาด L', short: 'ตะกร้า L', icon: 'basket', scale: 0.84, tare: 0 },
  { id: 'm', label: 'ตะกร้าขนาด M', short: 'ตะกร้า M', icon: 'basket', scale: 0.74, tare: 0 },
  { id: 's', label: 'ตะกร้าขนาด S', short: 'ตะกร้า S', icon: 'basket', scale: 0.64, tare: 0 },
]

export const getContainer = (id) => CONTAINERS.find((c) => c.id === id)

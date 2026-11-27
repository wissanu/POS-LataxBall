import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * ข้อความค้นหาของช่องค้นหาด้านบน (ใช้ได้เฉพาะ 3 หน้า)
 *  - New Order : gradeQuery = ค้นหารายการเกรดในหน้าจอ
 *  - ข้อมูลลูกค้า: customerQuery = ค้นหาชื่อลูกค้าในหน้าจอ
 *  - Order List: ใช้ stores/orders.js (ลูกค้า / เลขที่ใบรับซื้อ / ช่วงวันเวลา) เพราะต้องไปค้นที่ server
 */
export const useSearchStore = defineStore('search', () => {
  const gradeQuery = ref('')
  const customerQuery = ref('') // หน้า "ข้อมูลลูกค้า": ค้นหาชื่อลูกค้า
  const clearGrade = () => { gradeQuery.value = '' }
  return { gradeQuery, clearGrade, customerQuery }
})

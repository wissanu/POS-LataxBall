import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * ข้อความค้นหาของช่องค้นหาด้านบน (ใช้ได้เฉพาะ 2 หน้า)
 *  - New Order : gradeQuery = ค้นหารายการเกรดในหน้าจอ
 *  - Order List: ใช้ stores/orders.js (ลูกค้า / เลขที่ใบรับซื้อ / ช่วงวันเวลา) เพราะต้องไปค้นที่ server
 */
export const useSearchStore = defineStore('search', () => {
  const gradeQuery = ref('')
  const clearGrade = () => { gradeQuery.value = '' }
  return { gradeQuery, clearGrade }
})

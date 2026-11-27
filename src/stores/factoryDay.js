import { defineStore } from 'pinia'
import { ref } from 'vue'
import { factoryPriceService } from '@/services/factoryPriceService'
import { getErrorMessage } from '@/services/http'

/**
 * ราคาโรงงาน ณ วันที่ลงบิล ที่ผู้ใช้กำหนดเอง (หน้ารับออเดอร์ใหม่) — บาท/กก. ยางแห้ง DRC 100%
 *   price = null → ยังไม่ได้กำหนด: Bill & Print จะแจ้งเตือนและหยุดไว้ก่อน · suggestion = ราคาที่ระบบประเมิน (แค่ตัวช่วย ไม่ถือว่ากำหนดแล้ว)
 */
export const useFactoryDayStore = defineStore('factoryDay', () => {
  const date = ref('')
  const price = ref(null)
  const suggestion = ref(null)
  const loaded = ref(false)
  const saving = ref(false)
  const error = ref('')
  const focusTick = ref(0) // +1 = ขอให้ช่องราคาโรงงานรับโฟกัส (ตอนถูกแจ้งเตือนว่ายังไม่ได้กำหนด)
  let req = 0

  async function load(d) {
    if (!d) return
    const id = ++req
    date.value = d; loaded.value = false
    try {
      const r = await factoryPriceService.day(d)
      if (id !== req) return
      price.value = r.price; suggestion.value = r.suggestion ?? null; error.value = ''
    } catch (e) { if (id === req) { price.value = null; suggestion.value = null; error.value = getErrorMessage(e, 'โหลดราคาโรงงานไม่สำเร็จ') } } finally { if (id === req) loaded.value = true }
  }
  async function save(value) {
    saving.value = true; error.value = ''
    try {
      const r = await factoryPriceService.setDay(date.value, value)
      price.value = r.price; suggestion.value = r.suggestion ?? null
      return true
    } catch (e) { error.value = getErrorMessage(e, 'บันทึกราคาโรงงานไม่สำเร็จ'); return false } finally { saving.value = false }
  }
  const requestFocus = () => { focusTick.value++ }
  return { date, price, suggestion, loaded, saving, error, focusTick, load, save, requestFocus }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { factoryPriceService } from '@/services/factoryPriceService'
import { getErrorMessage } from '@/services/http'

/** ราคาโรงงานของวันนี้ (ประเมินจากราคากลาง แก้เองได้) — ใช้ร่วมกันระหว่างการ์ดราคาโรงงานกับแผงประเมินรายลูกค้า */
export const useFactoryPriceStore = defineStore('factoryPrice', () => {
  const data = ref(null)
  const check = ref(null)
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true; error.value = ''
    try { data.value = await factoryPriceService.today() } catch (e) { error.value = getErrorMessage(e, 'โหลดราคาโรงงานไม่สำเร็จ') } finally { loading.value = false }
  }
  async function refresh() {
    loading.value = true; error.value = ''
    try { data.value = await factoryPriceService.refresh(); await loadCheck() } catch (e) { error.value = getErrorMessage(e, 'ดึงราคากลางไม่สำเร็จ') } finally { loading.value = false }
  }
  async function setManual(price) {
    error.value = ''
    try { data.value = await factoryPriceService.setToday(price) } catch (e) { error.value = getErrorMessage(e, 'บันทึกราคาไม่สำเร็จ') }
  }
  async function loadCheck() {
    try { check.value = await factoryPriceService.check() } catch (e) { error.value = getErrorMessage(e, 'โหลดผลเทียบกับบิลไม่สำเร็จ') }
  }
  async function addRef(date, price) {
    error.value = ''
    try { check.value = await factoryPriceService.addRef(date, price); await load() } catch (e) { error.value = getErrorMessage(e, 'บันทึกราคากลางไม่สำเร็จ') }
  }
  return { data, check, loading, error, load, refresh, setManual, loadCheck, addRef }
})

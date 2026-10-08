import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsService } from '@/services/settingsService'
import { getErrorMessage } from '@/services/http'
import { DEFAULT_CONTAINERS } from '@/config/containers'

/** ตั้งค่าที่ผู้ใช้แก้ได้ — ตอนนี้คือน้ำหนักภาชนะ (tare) ของแต่ละปุ่ม */
export const useSettingsStore = defineStore('settings', () => {
  // start from the bundled defaults so the buttons render instantly; replaced by the server copy on load()
  const containers = ref(structuredClone(DEFAULT_CONTAINERS))
  const loaded = ref(false)
  const error = ref('')

  const byId = computed(() => Object.fromEntries(containers.value.map((c) => [c.id, c])))
  const tareOf = (id) => Number(byId.value[id]?.tare) || 0

  async function load(force = false) {
    if (loaded.value && !force) return
    error.value = ''
    try {
      containers.value = (await settingsService.getContainers()).containers
      loaded.value = true
    } catch (e) {
      error.value = getErrorMessage(e, 'โหลดการตั้งค่าไม่สำเร็จ ใช้ค่าเริ่มต้นแทน')
    }
  }

  /** tares = { [containerId]: number } — update only, nothing is added or removed */
  async function saveTares(tares) {
    const doc = await settingsService.updateContainers(Object.entries(tares).map(([id, tare]) => ({ id, tare })))
    containers.value = doc.containers
    loaded.value = true
    return doc
  }

  return { containers, loaded, error, byId, tareOf, load, saveTares }
})

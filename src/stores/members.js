import { defineStore } from 'pinia'
import { ref } from 'vue'
import { memberService } from '@/services/memberService'
import { getErrorMessage } from '@/services/http'

export const useMemberStore = defineStore('members', () => {
  const items = ref([])
  const loaded = ref(false)
  const error = ref('')

  async function load(force = false) {
    if (loaded.value && !force) return
    error.value = ''
    try {
      items.value = await memberService.list()
      loaded.value = true
    } catch (e) {
      error.value = getErrorMessage(e, 'โหลดรายชื่อลูกค้าประจำไม่สำเร็จ')
    }
  }

  return { items, loaded, error, load }
})

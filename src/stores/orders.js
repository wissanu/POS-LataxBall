import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import { getErrorMessage } from '@/services/http'

export const useOrderStore = defineStore('orders', () => {
  const list = ref([])
  const queue = ref([])
  const loading = ref(false)
  const error = ref('')
  const statusFilter = ref('all')

  const visible = computed(() =>
    statusFilter.value === 'all' ? list.value : list.value.filter((o) => o.status === statusFilter.value),
  )

  // silent = background refresh: no spinner, and the lists are only replaced when something actually changed
  async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
      const res = await orderService.list()
      if (JSON.stringify(list.value) !== JSON.stringify(res.data)) list.value = res.data
      if (JSON.stringify(queue.value) !== JSON.stringify(res.queue)) queue.value = res.queue
      error.value = ''
    } catch (e) {
      const msg = getErrorMessage(e, 'โหลดรายการไม่สำเร็จ')
      if (msg !== error.value) error.value = msg // a toast is shown once per distinct problem (not on every poll)
    } finally {
      loading.value = false
    }
  }

  // รับข้อมูลแบบต่อเนื่อง: ดึงรายการใหม่ทุก 5 วินาทีขณะเปิดหน้านี้และแท็บมองเห็นอยู่
  let poller = null
  const tick = () => { if (document.visibilityState === 'visible') load({ silent: true }) }
  function startPolling(ms = 5000) {
    stopPolling()
    poller = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
  }
  function stopPolling() {
    clearInterval(poller)
    poller = null
    document.removeEventListener('visibilitychange', tick)
  }

  async function setStatus(id, status) {
    const updated = await orderService.updateStatus(id, status)
    const i = list.value.findIndex((o) => o.id === id)
    if (i !== -1) list.value[i] = updated
    const chip = queue.value.find((c) => c.id === id)
    if (chip) chip.status = updated.status
    return updated
  }

  return { list, queue, loading, error, statusFilter, visible, load, setStatus, startPolling, stopPolling }
})

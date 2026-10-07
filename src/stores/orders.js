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

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const res = await orderService.list()
      list.value = res.data
      queue.value = res.queue
    } catch (e) {
      error.value = getErrorMessage(e, 'Could not load orders.')
    } finally {
      loading.value = false
    }
  }

  async function setStatus(id, status) {
    const updated = await orderService.updateStatus(id, status)
    const i = list.value.findIndex((o) => o.id === id)
    if (i !== -1) list.value[i] = updated
    const chip = queue.value.find((c) => c.id === id)
    if (chip) chip.status = status
    return updated
  }

  return { list, queue, loading, error, statusFilter, visible, load, setStatus }
})

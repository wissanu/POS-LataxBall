import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import { getErrorMessage } from '@/services/http'

export const PAGE_SIZE = 9 // 3 แถว x 3 หลัก ต่อหน้า

const emptySearch = () => ({ no: '', customer: null, from: '', to: '' })

/**
 * รายการรับซื้อ (หน้า Order List)
 *  - ค่าเริ่มต้น: เฉพาะ "วันนี้" · toggle scope = 'all' เพื่อดูทุกวัน (หาใบย้อนหลัง)
 *  - แบ่งหน้าและกรองสถานะที่ server (หน้าละ 9 ใบ)
 *  - ค้นหา (เลขที่ใบ / ลูกค้า / ช่วงวันเวลา) = ค้นข้ามทุกวัน: toggle ถูกล็อกเป็น "ทุกวัน" ระหว่างค้นหา
 */
export const useOrderStore = defineStore('orders', () => {
  const list = ref([])
  const queue = ref([])
  const loading = ref(false)
  const error = ref('')
  const statusFilter = ref('all')
  const scope = ref('today') // 'today' | 'all'
  const page = ref(1)
  const total = ref(0)
  const totalPages = ref(1)
  const search = ref(emptySearch()) // { no, customer: {id,name,code,...}|null, from, to }

  const hasSearch = computed(() => !!(search.value.no || search.value.customer || search.value.from || search.value.to))
  const effectiveScope = computed(() => (hasSearch.value ? 'all' : scope.value))

  function params() {
    const s = search.value
    const p = { scope: effectiveScope.value, page: page.value, pageSize: PAGE_SIZE }
    if (statusFilter.value !== 'all') p.status = statusFilter.value
    if (s.no) p.q = s.no
    if (s.customer) p.customerId = s.customer.id
    if (s.from) p.from = s.from
    if (s.to) p.to = s.to
    return p
  }

  // silent = background refresh: no spinner, and the lists are only replaced when something actually changed
  let seq = 0
  async function load({ silent = false } = {}) {
    const mine = ++seq
    if (!silent) loading.value = true
    try {
      const res = await orderService.list(params())
      if (mine !== seq) return // a newer request was sent meanwhile — ignore this late answer
      if (JSON.stringify(list.value) !== JSON.stringify(res.data)) list.value = res.data
      if (JSON.stringify(queue.value) !== JSON.stringify(res.queue)) queue.value = res.queue
      total.value = res.total
      totalPages.value = res.totalPages
      if (res.page !== page.value) page.value = res.page // server pulled us back to the last page
      error.value = ''
    } catch (e) {
      if (mine !== seq) return
      const msg = getErrorMessage(e, 'โหลดรายการไม่สำเร็จ')
      if (msg !== error.value) error.value = msg // a toast is shown once per distinct problem (not on every poll)
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  // ---- view controls: any change goes back to page 1 and reloads ----
  function goPage(n) {
    if (n < 1 || n > totalPages.value || n === page.value) return
    page.value = n
    load()
  }
  function setScope(v) {
    scope.value = v === 'all' ? 'all' : 'today'
    page.value = 1
    load()
  }
  function setStatusFilter(v) {
    statusFilter.value = v
    page.value = 1
    load()
  }
  /** patch = { no?, customer?, from?, to? } */
  function applySearch(patch) {
    search.value = { ...search.value, ...patch }
    page.value = 1
    load()
  }
  /** key: 'no' | 'customer' | 'range' */
  function removeSearch(key) {
    const s = { ...search.value }
    if (key === 'no') s.no = ''
    else if (key === 'customer') s.customer = null
    else { s.from = ''; s.to = '' }
    search.value = s
    page.value = 1
    load()
  }
  function clearSearch() {
    search.value = emptySearch()
    page.value = 1
    load()
  }
  /** leaving the page: back to the default view (today · page 1 · no search). The status filter is kept (Draft List sets it before navigating). */
  function resetView() {
    scope.value = 'today'
    page.value = 1
    search.value = emptySearch()
  }

  // รับข้อมูลแบบต่อเนื่อง: ดึงรายการใหม่ทุก 5 วินาทีขณะเปิดหน้านี้และแท็บมองเห็นอยู่ (หน้า/ตัวกรองเดิม)
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
    load({ silent: true }) // the status filter / totals may have changed
    return updated
  }

  return {
    list, queue, loading, error, statusFilter, scope, page, total, totalPages, search, hasSearch, effectiveScope,
    load, goPage, setScope, setStatusFilter, applySearch, removeSearch, clearSearch, resetView, setStatus, startPolling, stopPolling,
  }
})

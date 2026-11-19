import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import { getErrorMessage } from '@/services/http'

export const PAGE_SIZE = 20 // 20 แถวต่อหน้า (server ตัดที่ 50)
export const RANGES = [
  { v: 'today', label: 'วันนี้' },
  { v: 'month', label: 'เดือนนี้' },
]

// สถานะการขายให้โรงงาน (ใบที่ยืนยันแล้ว): รอจัดส่ง → กำลังจัดส่ง (อยู่ในฉบับร่างเที่ยวขนส่ง) → ขายเรียบร้อยแล้ว
export const SALE_STATES = [
  { v: 'waiting', label: 'รอจัดส่ง', icon: 'clock' },
  { v: 'shipping', label: 'กำลังจัดส่ง', icon: 'truck' },
  { v: 'sold', label: 'ขายเรียบร้อยแล้ว', icon: 'check' },
]
export const SALE_FILTERS = [
  { v: 'all', label: 'ทุกสถานะการขาย' },
  { v: 'unsold', label: 'ยังไม่ขาย (รอจัดส่ง + กำลังจัดส่ง)' },
  ...SALE_STATES.map(({ v, label }) => ({ v, label })),
]

const emptySearch = () => ({ no: '', customer: null, from: '', to: '' })

/**
 * รายการรับซื้อ (หน้า Order List)
 *  - ไม่เคยดึง "ทุกวัน" ทั้งหมดอีกแล้ว: ค่าเริ่มต้น "วันนี้" · เลือกดู "เดือนนี้" ได้ (range)
 *  - แบ่งหน้าและกรองสถานะที่ server (หน้าละ 20 แถว)
 *  - ค้นหา (เลขที่ใบ / ลูกค้า / ช่วงวันเวลา) = ค้นข้ามทุกวันได้เสมอ ไม่ติดช่วงข้างบน (แคบด้วยเงื่อนไข + แบ่งหน้า + index ที่ server)
 */
export const useOrderStore = defineStore('orders', () => {
  const list = ref([])
  const queue = ref([])
  const loading = ref(false)
  const error = ref('')
  const statusFilter = ref('all')
  const saleFilter = ref('all') // 'all' | 'unsold' | 'waiting' | 'shipping' | 'sold'
  const range = ref('today') // 'today' | 'month'
  const windowFrom = ref('') // ช่วงวันที่ที่ server ใช้จริงตอนไม่ค้นหา (YYYY-MM-DD)
  const windowTo = ref('')
  const page = ref(1)
  const total = ref(0)
  const totalPages = ref(1)
  const summary = ref({ bills: 0, netKg: 0, total: 0, excluded: 0, byProduct: [], adjustment: 0 }) // ยอดรวมของตัวกรองปัจจุบัน (ทุกหน้า) · byProduct = แยกยางก้อนถ้วย/ขี้ฟอง
  const search = ref(emptySearch()) // { no, customer: {id,name,code,...}|null, from, to }

  const hasSearch = computed(() => !!(search.value.no || search.value.customer || search.value.from || search.value.to))

  function params() {
    const s = search.value
    const p = { page: page.value, pageSize: PAGE_SIZE }
    if (!hasSearch.value) p.range = range.value
    if (statusFilter.value !== 'all') p.status = statusFilter.value
    if (s.no) p.q = s.no
    if (s.customer?.named) p.customerName = s.customer.name // ชื่อที่กรอกตอนรับซื้อ (ลูกค้าทั่วไป/สวน)
    else if (s.customer) p.customerId = s.customer.id
    if (saleFilter.value !== 'all') p.sale = saleFilter.value
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
      if (res.summary) summary.value = res.summary
      windowFrom.value = res.windowFrom || ''
      windowTo.value = res.windowTo || ''
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
  function setRange(v) {
    range.value = RANGES.some((r) => r.v === v) ? v : 'today'
    page.value = 1
    load()
  }
  function setStatusFilter(v) {
    statusFilter.value = v
    page.value = 1
    load()
  }
  function setSaleFilter(v) {
    saleFilter.value = SALE_FILTERS.some((f) => f.v === v) ? v : 'all'
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
    saleFilter.value = 'all'
    page.value = 1
    load()
  }
  /** leaving the page: back to the default view (today · page 1 · no search). The status filter is kept (Draft List sets it before navigating). */
  function resetView() {
    range.value = 'today'
    page.value = 1
    saleFilter.value = 'all'
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
    list, queue, loading, error, statusFilter, saleFilter, range, windowFrom, windowTo, page, total, totalPages, summary, search, hasSearch,
    load, goPage, setRange, setStatusFilter, setSaleFilter, applySearch, removeSearch, clearSearch, resetView, setStatus, startPolling, stopPolling,
  }
})

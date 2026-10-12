import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { priceBoardService } from '@/services/priceBoardService'
import { getErrorMessage } from '@/services/http'
import { bangkokDate, nextBangkokMidnight } from '@/utils/dates'

const POLL_MS = 30000 // pick up changes made on another counter (e.g. the manager sets today's prices)
const CHECK_MS = 15000 // day-change check (timers are throttled in background tabs / sleeping laptops)

/**
 * ราคารับซื้อของวันนี้ (หน้า New Order)
 *  - 1 วัน = 1 กลุ่ม มีเกรด A, B+, B, C+, C, D — ไม่มีข้อมูล = หน้าจอ "ยังไม่มีข้อมูลของวันนี้"
 *  - เที่ยงคืนเวลาไทย: รายการที่แสดงถูกรีเซ็ตทันที (เหลือหน้าจอว่าง) แล้วโหลดของวันใหม่ — เห็นเฉพาะวันนี้เท่านั้น
 *  - "วัน" ยึดเวลาเซิร์ฟเวอร์ (คำนวณส่วนต่างจากนาฬิกาเครื่องไว้) ไม่ใช่นาฬิกาเครื่องที่อาจตั้งผิด
 */
export const usePriceBoardStore = defineStore('priceBoard', () => {
  const loaded = ref(false)
  const loading = ref(false)
  const busy = ref(false) // sync / save / discard in progress
  const error = ref('')
  const date = ref('') // วันที่ของข้อมูลที่แสดงอยู่
  const exists = ref(false)
  const board = ref(null) // { id, date, copiedFrom, createdAt }
  const grades = ref([]) // [{ code, name }] เกรดที่ใช้งาน
  const items = ref([]) // [{ id, grade, name, price }]
  const yesterday = ref({ date: '', available: false })
  const dayChanges = ref(0) // +1 every time midnight passes (the page clears the cart on it)

  let offset = 0 // เวลาเซิร์ฟเวอร์ − เวลาเครื่อง (ms)
  const serverNow = () => new Date(Date.now() + offset)
  const today = () => bangkokDate(serverNow())

  const products = computed(() => items.value)
  const canSync = computed(() => !exists.value && yesterday.value.available)

  function apply(res) {
    offset = Date.parse(res.serverTime) - Date.now()
    date.value = res.date
    exists.value = res.exists
    board.value = res.board
    grades.value = res.grades
    // keep the old array when nothing changed so the grid does not re-render on every poll
    if (JSON.stringify(items.value) !== JSON.stringify(res.items)) items.value = res.items
    yesterday.value = res.yesterday
    loaded.value = true
    error.value = ''
  }

  async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
      apply(await priceBoardService.get())
    } catch (e) {
      // report an outage once (the page shows a toast) — polling must not spam
      const msg = getErrorMessage(e, 'โหลดราคารับซื้อไม่สำเร็จ')
      if (msg !== error.value) error.value = msg
    } finally {
      loading.value = false
    }
  }

  async function run(fn) {
    busy.value = true
    try {
      apply(await fn())
    } finally {
      busy.value = false
    }
  }
  const save = (prices) => run(() => priceBoardService.save(prices))
  const syncYesterday = () => run(() => priceBoardService.syncYesterday())
  const discard = (ids) => run(() => priceBoardService.discard(ids))

  // ---- midnight reset -------------------------------------------------------
  let timers = []
  function checkDay() {
    if (!loaded.value || date.value === today()) return
    // a new day started: wipe what is on screen at once, then load the new day (normally "no data yet")
    date.value = today()
    exists.value = false
    board.value = null
    items.value = []
    yesterday.value = { date: '', available: false }
    dayChanges.value++
    load({ silent: true })
    armMidnight()
  }
  function armMidnight() {
    clearTimeout(timers.midnight)
    const ms = nextBangkokMidnight(today()) - serverNow().getTime() + 300
    timers.midnight = setTimeout(checkDay, Math.min(Math.max(ms, 1000), 2 ** 31 - 1))
  }
  function onVisible() {
    if (document.visibilityState === 'visible') { checkDay(); load({ silent: true }) }
  }

  /** call when the New Order page opens; stop() when it closes */
  function start() {
    stop()
    load()
    armMidnight()
    timers.check = setInterval(checkDay, CHECK_MS)
    timers.poll = setInterval(() => document.visibilityState === 'visible' && !busy.value && load({ silent: true }), POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
  }
  function stop() {
    clearTimeout(timers.midnight)
    clearInterval(timers.check)
    clearInterval(timers.poll)
    timers = []
    document.removeEventListener('visibilitychange', onVisible)
  }

  return { loaded, loading, busy, error, date, exists, board, grades, items, products, yesterday, canSync, dayChanges, load, save, syncYesterday, discard, start, stop }
})

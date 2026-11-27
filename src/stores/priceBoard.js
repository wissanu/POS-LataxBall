import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { priceBoardService } from '@/services/priceBoardService'
import { getErrorMessage } from '@/services/http'
import { bangkokDate, nextBangkokMidnight } from '@/utils/dates'

const POLL_MS = 30000 // pick up changes made on another counter (e.g. the manager sets today's prices)
const CHECK_MS = 15000 // day-change check (timers are throttled in background tabs / sleeping laptops)

/**
 * ราคารับซื้อของวันนี้ (หน้ารับออเดอร์ใหม่)
 *  - 1 วัน = 1 กลุ่ม มีเกรด A+, A, B+, B, C+, C, D — ไม่มีข้อมูล = หน้าจอ "ยังไม่มีข้อมูลของวันนี้"
 *  - sync ใช้ได้เฉพาะ: ยังไม่มีข้อมูลของวันนี้ หรือ discard ทิ้งทั้งหมดแล้ว — ต้นทาง = เมื่อวาน (ถ้าเมื่อวานร้านหยุด = วันเปิดทำการล่าสุด)
 *  - เที่ยงคืนเวลาไทย: รายการที่แสดงถูกรีเซ็ตทันที (เหลือหน้าจอว่าง) แล้วโหลดของวันใหม่ — เห็นเฉพาะวันนี้เท่านั้น
 *  - "วัน" ยึดเวลาเซิร์ฟเวอร์ (คำนวณส่วนต่างจากนาฬิกาเครื่องไว้) ไม่ใช่นาฬิกาเครื่องที่อาจตั้งผิด
 *  - ทำบิลย้อนหลัง: setDate('YYYY-MM-DD') เลือกวันที่ผ่านมาแล้วเพื่อลงบิลของวันนั้น (ใช้ราคาของวันนั้น) · '' = วันนี้ (ปกติ)
 *    ขณะดูวันย้อนหลัง เที่ยงคืนไม่รีเซ็ตหน้าจอ (ค้างวันที่เลือกไว้) และ sync/save/discard ทำกับวันที่เลือก
 */
export const usePriceBoardStore = defineStore('priceBoard', () => {
  const loaded = ref(false)
  const loading = ref(false)
  const busy = ref(false) // sync / save / discard in progress
  const error = ref('')
  const date = ref('') // วันที่ของข้อมูลที่แสดงอยู่
  const exists = ref(false)
  const board = ref(null) // { id, date, copiedFrom, createdAt }
  const grades = ref([]) // [{ code, name, productType }] เกรดที่ใช้งาน
  const productTypes = ref([]) // [{ code: 'CUP_LUMP'|'FOAM', label }] ประเภทสินค้า (ตั้งราคาแยกกัน)
  const items = ref([]) // [{ id, grade, name, price }]
  const syncSource = ref(null) // { date, isYesterday } วันต้นทางที่ sync ได้ (null = sync ไม่ได้)
  const discardedAll = ref(false) // มีกลุ่มของวันนี้ แต่ถูก discard ทิ้งทั้งหมด
  const missingGrades = ref([]) // เกรดที่ใช้งานอยู่แต่ยังไม่มีราคาวันนี้ (เช่น เกรดใหม่)
  const dayChanges = ref(0) // +1 every time midnight passes (the page clears the cart on it)
  const selectedDate = ref('') // '' = วันนี้ · 'YYYY-MM-DD' = ทำบิลย้อนหลังของวันนั้น
  const todayStr = ref(bangkokDate()) // วันนี้ (ตามเวลาเซิร์ฟเวอร์) — ใช้กำหนดวันสูงสุดที่เลือกได้
  const isBackdated = computed(() => !!selectedDate.value && selectedDate.value < todayStr.value)

  let offset = 0 // เวลาเซิร์ฟเวอร์ − เวลาเครื่อง (ms)
  const serverNow = () => new Date(Date.now() + offset)
  const today = () => bangkokDate(serverNow())

  const products = computed(() => items.value)
  const canSync = computed(() => !!syncSource.value)

  function apply(res) {
    offset = Date.parse(res.serverTime) - Date.now()
    todayStr.value = res.today || todayStr.value
    date.value = res.date
    exists.value = res.exists
    board.value = res.board
    grades.value = res.grades
    productTypes.value = res.productTypes ?? []
    // keep the old array when nothing changed so the grid does not re-render on every poll
    if (JSON.stringify(items.value) !== JSON.stringify(res.items)) items.value = res.items
    syncSource.value = res.syncSource ?? null
    discardedAll.value = !!res.discardedAll
    missingGrades.value = res.missingGrades ?? []
    loaded.value = true
    error.value = ''
  }

  let loadSeq = 0
  async function load({ silent = false } = {}) {
    const mine = ++loadSeq
    if (!silent) loading.value = true
    try {
      const res = await priceBoardService.get(selectedDate.value || undefined)
      if (mine !== loadSeq) return // เลือกวันใหม่ระหว่างรอ — ทิ้งคำตอบของวันเก่า
      apply(res)
    } catch (e) {
      if (mine !== loadSeq) return
      // report an outage once (the page shows a toast) — polling must not spam
      const msg = getErrorMessage(e, 'โหลดราคารับซื้อไม่สำเร็จ')
      if (msg !== error.value) error.value = msg
    } finally {
      if (mine === loadSeq) loading.value = false
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
  const save = (prices) => run(() => priceBoardService.save(prices, selectedDate.value || undefined))
  const syncYesterday = () => run(() => priceBoardService.syncYesterday(selectedDate.value || undefined))
  const discard = (ids) => run(() => priceBoardService.discard(ids, selectedDate.value || undefined))

  /** เลือกวันที่ลงบิล: วันนี้หรืออนาคต = กลับเป็นวันนี้ · วันที่ผ่านมาแล้ว = ทำบิลย้อนหลัง (ล้างหน้าจอแล้วโหลดราคาของวันนั้น) */
  async function setDate(d) {
    const next = !d || d >= today() ? '' : d
    if (next === selectedDate.value && loaded.value) return
    selectedDate.value = next
    exists.value = false; board.value = null; items.value = []; syncSource.value = null; discardedAll.value = false; missingGrades.value = []
    date.value = next || today()
    await load()
  }
  /** ออกจากหน้ารับออเดอร์ใหม่: กลับไปโหมดวันนี้ (ไม่โหลดซ้ำ — ครั้งหน้าที่เปิดหน้าจะโหลดเอง) */
  const resetDate = () => { selectedDate.value = '' }

  // ---- midnight reset -------------------------------------------------------
  let timers = []
  function checkDay() {
    if (!loaded.value) return
    const t = today()
    if (selectedDate.value) {
      // กำลังทำบิลย้อนหลัง: ค้างวันที่เลือกไว้ (ไม่รีเซ็ตหน้าจอ) · ถ้าวันที่เลือกกลายเป็นวันนี้ = กลับโหมดปกติ
      todayStr.value = t
      if (selectedDate.value >= t) { selectedDate.value = ''; load({ silent: true }) }
      armMidnight()
      return
    }
    if (date.value === t) return
    // a new day started: wipe what is on screen at once, then load the new day (normally "no data yet")
    date.value = today()
    exists.value = false
    board.value = null
    items.value = []
    syncSource.value = null
    discardedAll.value = false
    missingGrades.value = []
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

  return { loaded, loading, busy, error, date, exists, board, grades, productTypes, items, products, syncSource, discardedAll, missingGrades, canSync, dayChanges, selectedDate, todayStr, isBackdated, setDate, resetDate, load, save, syncYesterday, discard, start, stop }
})

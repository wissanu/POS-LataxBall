// "วัน" ของร้านนับตามเวลาไทย (Asia/Bangkok) เสมอ ไม่ว่าเครื่องจะตั้งเขตเวลาไว้อย่างไร
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })

/** วันที่ตามเวลาไทยในรูป YYYY-MM-DD */
export const bangkokDate = (d = new Date()) => fmt.format(d)

/** บวก/ลบวัน (คิดแบบปฏิทิน) */
export const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** เวลา (ms) ของเที่ยงคืนเวลาไทยที่จะมาถึง นับจากวันที่ `today` (YYYY-MM-DD) */
export const nextBangkokMidnight = (today) => Date.parse(`${addDays(today, 1)}T00:00:00+07:00`)

/** "2026-10-11" -> "11 ต.ค. 2569" */
const thai = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const formatThaiDate = (s) => {
  const d = s ? new Date(`${s}T00:00:00Z`) : null
  return d && !Number.isNaN(d.getTime()) ? thai.format(d) : '' // safe before the first load (empty date)
}
